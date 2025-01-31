import { Test, TestingModule } from '@nestjs/testing';
import { HpcService } from './hpc.service';
import { SshService } from '../ssh/ssh.service';
import { ConfigService } from '@nestjs/config';
import { SharedNatsClientModule } from '@biosimulations/shared/nats-client';
import { SbatchService } from '../sbatch/sbatch.service';
import { FilePaths } from '@biosimulations/shared/storage';

describe('HpcService', () => {
  let service: HpcService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [SharedNatsClientModule],
      providers: [
        HpcService,
        { provide: SshService, useValue: {} },
        ConfigService,
        SbatchService,
        { provide: FilePaths, useValue: {} },
      ],
    }).compile();

    service = module.get<HpcService>(HpcService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
