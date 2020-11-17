import { Controller, Logger, Inject } from '@nestjs/common';
import {
  MessagePattern,
  ClientProxy,
  EventPattern,
} from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { HpcService } from './services/hpc/hpc.service';
import { SbatchService } from './services/sbatch/sbatch.service';
import {
  DispatchSimulationStatus,
  SimulationDispatchSpec,
} from '@biosimulations/dispatch/api-models';
import { v4 as uuid } from 'uuid';
import path from 'path';
import * as csv2Json from 'csv2json';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import {
  createdResponse,
  DispatchCreatedPayload,
  DispatchMessage,
  DispatchPayload,
  MQDispatch,
} from '@biosimulations/messages/messages';
import { ArchiverService } from './services/archiver/archiver.service';
import { ModelsService } from './resources/models/models.service';
import { SimulationService } from './services/simulation/simulation.service';
import { FileModifiers } from '@biosimulations/dispatch/file-modifiers';

@Controller()
export class AppController {
  constructor(
    private readonly configService: ConfigService,
    private hpcService: HpcService,
    private sbatchService: SbatchService,
    @Inject('DISPATCH_MQ') private messageClient: ClientProxy,
    private schedulerRegistry: SchedulerRegistry,
    private archiverService: ArchiverService,
    private modelsService: ModelsService,
    private simulationService: SimulationService
  ) {}
  private logger = new Logger(AppController.name);
  private fileStorage: string = this.configService.get<string>(
    'hpc.fileStorage',
    ''
  );

  /**
   *
   * @param data The payload sent for the created simulation run message
   * The method responds to the message by calling the hpc service to start a job. It then sends a reply to the message.
   */
  @MessagePattern(DispatchMessage.created)
  async uploadFile(data: DispatchCreatedPayload): Promise<createdResponse> {
    this.logger.log('Starting to dispatch simulation');
    this.logger.log('Data received: ' + JSON.stringify(data));

    if (
      data.simulator !== 'copasi' &&
      data.simulator !== 'vcell' &&
      data.simulator !== 'tellurium' &&
      data.simulator !== 'cobrapy' &&
      data.simulator !== 'bionetgen'
    ) {
      return new createdResponse(false, 'invalid simulator');
    }
    // TODO have this send back a status and adjust response accordingly
    this.hpcService.dispatchJob(
      data.simulationId,
      data.simulator,
      data.version,
      data.fileName
    );
    return new createdResponse();
  }

  @MessagePattern(MQDispatch.SIM_HPC_FINISH)
  async dispatchFinish(uuid: string) {
    this.logger.log('Simulation Finished on HPC');
    const resDir = path.join(this.fileStorage, 'simulations', uuid, 'out');
    const allFilesInfo = await FileModifiers.getFilesRecursive(resDir);
    const allFiles = [];
    const directoryList = [];

    for (let index = 0; index < allFilesInfo.length; index++) {
      if (
        allFilesInfo[index].name === 'job.output' ||
        allFilesInfo[index].name === 'job.error'
      ) {
        //TODO:  Remove these files
      } else if (allFilesInfo[index].name.endsWith('.csv')) {
        // Getting only relative path
        allFiles.push(allFilesInfo[index].path.substring(resDir.length + 1));
      }
    }

    // Seperating files from directory paths to create structure
    for (const filePath of allFiles) {
      const filePathSplit = filePath.split('/');

      //Removing task files
      filePathSplit.splice(filePathSplit.length - 1, 1);
      directoryList.push(filePathSplit.join('/'));
    }

    // this.logger.log('Log message data: ' + JSON.stringify(data));
    this.logger.log('Output directory: ' + resDir);

    // const directoryList = await FileModifiers.readDir(resDir);

    // NOTE: job.output is the Log file generated by the SBATCH simulation job
    // const logFileIndex = directoryList.indexOf('job.output');
    // directoryList.splice(logFileIndex);

    const dirLength = directoryList.length;
    let dirCounter = 0;
    for (const directoryName of directoryList) {
      FileModifiers.readDir(path.join(resDir, directoryName)).then(
        (fileList: any) => {
          const fileLength = fileList.length;
          let fileCounter = 0;
          for (const filename of fileList) {
            if (filename.endsWith('csv')) {
              const filePath = path.join(resDir, directoryName, filename);
              this.logger.log('Reading file: ' + filePath);

              const jsonPath = filePath.split('.csv')[0] + '.json';

              fs.createReadStream(filePath)
                .pipe(
                  csv2Json.default({
                    separator: ',',
                  })
                )
                .pipe(fs.createWriteStream(jsonPath))
                .on('close', () => {
                  // Convert CSV to chart JSON
                  const chartJsonPath =
                    jsonPath.split('.json')[0] + '_chart.json';
                  FileModifiers.readFile(jsonPath).then((jsonData: any) => {
                    const chartResults = this.convertJsonDataToChartData(
                      JSON.parse(jsonData)
                    );
                    FileModifiers.writeFile(
                      chartJsonPath,
                      JSON.stringify(chartResults)
                    ).then(() => {
                      fileCounter++;
                      dirCounter++;
                      if (
                        fileCounter === fileLength &&
                        dirCounter === dirLength
                      ) {
                        this.messageClient.emit(
                          MQDispatch.SIM_RESULT_FINISH,
                          uuid
                        );
                      }
                    });
                  });
                })
                .on('error', (err) => {
                  return this.logger.log(
                    'Error occured in file writing' + JSON.stringify(err)
                  );
                });
            }
          }
        }
      );
    }
  }

  @MessagePattern(MQDispatch.SIM_RESULT_FINISH)
  async resultFinish(uuid: string) {
    this.archiverService.createResultArchive(uuid).then(() => {});
  }

  @MessagePattern(MQDispatch.SIM_DISPATCH_FINISH)
  async dispatchLog(data: any) {
    const slurmjobId = data['hpcOutput']['stdout'].match(/\d+/)[0];
    const simDirSplit = data['simDir'].split('/');
    const uuid = simDirSplit[simDirSplit.length - 1];
    // TODO: research more for better duration
    this.jobMonitorCronJob(slurmjobId, uuid, 30);
  }

  async jobMonitorCronJob(jobId: string, uuid: string, seconds: number) {
    const job = new CronJob(`${seconds.toString()} * * * * *`, async () => {
      const jobStatus =
        (await this.simulationService.getSimulationStatus(jobId)) ||
        DispatchSimulationStatus.QUEUED;
      this.modelsService.updateStatus(uuid, jobStatus);
      switch (jobStatus) {
        case DispatchSimulationStatus.SUCCEEDED:
          // TODO: Change FINISH to SUCCEED
          this.messageClient.emit(MQDispatch.SIM_HPC_FINISH, uuid);
          this.schedulerRegistry.getCronJob(jobId).stop();
          break;
        // TODO: Create another MQ function 'FAILED' to zip the failed simulation for troubleshooting
        case DispatchSimulationStatus.FAILED:
          this.schedulerRegistry.getCronJob(jobId).stop();
          break;
        case DispatchSimulationStatus.QUEUED:
        case DispatchSimulationStatus.RUNNING:
          break;
      }
    });

    this.schedulerRegistry.addCronJob(jobId, job);
    job.start();
  }

  convertJsonDataToChartData(data: any) {
    const finalRes: any = {};

    const taskKeys = Object.keys(data[0]);
    const timeKey = taskKeys[0];
    taskKeys.splice(taskKeys.indexOf(timeKey), 1);

    for (const taskKey of taskKeys) {
      finalRes[taskKey] = {};
      finalRes[taskKey]['x'] = [];
      finalRes[taskKey]['y'] = [];
      finalRes[taskKey]['type'] = 'scatter';
    }

    for (const dataObj of data) {
      for (const taskKey of taskKeys) {
        finalRes[taskKey]['x'].push(dataObj[timeKey]);
        finalRes[taskKey]['y'].push(dataObj[taskKey]);
      }
    }

    return finalRes;
  }
}
