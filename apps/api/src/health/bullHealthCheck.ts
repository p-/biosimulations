import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import {
  InjectQueue,
  InjectQueueEvents,
  Process,
  Processor,
} from '@biosimulations/nestjs-bullmq';
import { Job, Queue, QueueEvents } from 'bullmq';
import { JobQueue } from '@biosimulations/messages/messages';

const JOB_NAME = 'healthCheck';
@Processor(JobQueue.health)
export class HealthCheckProcessor {
  @Process(JOB_NAME)
  private async healthCheck(job: Job<any>): Promise<boolean> {
    return true;
  }
}

@Injectable()
export class BullHealthIndicator extends HealthIndicator {
  private logger = new Logger('BullHealthIndicator');
  public constructor(
    @InjectQueueEvents(JobQueue.health) private queueEvents: QueueEvents,
    @InjectQueue(JobQueue.health) private readonly healthQueue: Queue,
  ) {
    super();
  }

  public async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const res = await this.healthQueue.add(
        JOB_NAME,
        {
          job: JOB_NAME,
        },
        {
          timeout: 1000,
          attempts: 1,
        },
      );

      await res.waitUntilFinished(this.queueEvents);
      const status = await res.isCompleted();
      return this.getStatus(key, status);
    } catch (e) {
      throw new HealthCheckError((e as any)?.message, e);
    }
  }
}
