import { SimulationRunStatus } from '@biosimulations/datamodel/common';
import { JobQueue, MonitorJobData, SubmitHPCSimulationRunJobData } from '@biosimulations/messages/messages';

import { BiosimulationsException } from '@biosimulations/shared/exceptions';
import { InjectQueue, Process, Processor } from '@biosimulations/nestjs-bullmq';
import { Logger, HttpStatus } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { HpcService } from '../services/hpc/hpc.service';
import { SimulationStatusService } from '../services/simulationStatus.service';

@Processor(JobQueue.dispatch)
export class DispatchProcessor {
  private readonly logger = new Logger(DispatchProcessor.name);

  public constructor(
    private hpcService: HpcService,
    private simStatusService: SimulationStatusService,
    @InjectQueue(JobQueue.monitor) private monitorQueue: Queue<MonitorJobData>,
  ) {}

  @Process({ concurrency: 10 })
  private async handleSubmission(job: Job<SubmitHPCSimulationRunJobData>): Promise<void> {
    const data = job.data;

    this.logger.debug(`Starting job for simulation run '${data.runId}' ...`);

    // submit job to HPC
    this.logger.debug(`Submitting job for simulation run '${data.runId}' to HPC ...`);
    const response = await this.hpcService.submitJob(
      data.runId,
      data.simulator,
      data.simulatorVersion,
      data.cpus,
      data.memory,
      data.maxTime,
      data.envVars,
      data.purpose,
    );

    if (response.stderr != '' || response.stdout === null) {
      // There was an error with submission of the job
      const message = `An error occurred in submitting an HPC job for simulation run '${data.runId}': ${response.stderr}`;
      this.logger.error(message);
      job.log(message);
      if (job.attemptsMade >= (job.opts.attempts || 0)) {
        await this.simStatusService.updateStatus(data.runId, SimulationRunStatus.FAILED);
      }

      throw new BiosimulationsException(HttpStatus.INTERNAL_SERVER_ERROR, 'Error occurred in job submission', message);
    }

    // Get the Slurm id of the job
    // Expected output of the response is " Submitted batch job <ID> /n"
    const slurmjobId = response.stdout.trim().split(' ').slice(-1)[0];

    // Initiate monitoring of the job
    this.logger.debug(`Initiating monitoring for job '${slurmjobId}' for simulation run '${data.runId}' ...`);

    const monitorData: MonitorJobData = {
      slurmJobId: slurmjobId.toString(),
      runId: data.runId,
      projectId: data.projectId,
      projectOwner: data.projectOwner,
      retryCount: 0,
    };
    const monitorOptions = {
      attempts: 10,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    };

    this.monitorQueue.add('monitor', monitorData, monitorOptions);
  }
}
