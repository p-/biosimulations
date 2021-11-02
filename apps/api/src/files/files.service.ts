import { SubmitProjectFile } from '@biosimulations/datamodel/api';
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeleteResult } from 'mongodb';
import { FileModel } from './files.model';
import { SharedStorageService } from '@biosimulations/shared/storage';
import { Endpoints } from '@biosimulations/config/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FilesService {
  private endpoints: Endpoints;

  public constructor(
    @InjectModel(FileModel.name) private model: Model<FileModel>,
    private storage: SharedStorageService,
    private configService: ConfigService,
  ) {
    const env = configService.get('server.env');
    this.endpoints = new Endpoints(env);
  }

  public async getSimulationRunFiles(runId: string): Promise<FileModel[]> {
    return this.model.find({ simulationRun: runId }).exec();
  }

  public async getFile(
    runId: string,
    fileLocation: string,
  ): Promise<FileModel | null> {
    return this.model.findOne({
      $or: [
        { id: this.getFileId(runId, fileLocation, true) },
        { id: this.getFileId(runId, fileLocation, false) },
      ],
    });
  }

  public async createFiles(files: SubmitProjectFile[]): Promise<FileModel[]> {
    const createdFiles = [];
    for (const file of files) {
      const fileModel = new this.model(file);
      createdFiles.push(fileModel.save());
    }
    return Promise.all(createdFiles);
  }

  /*
  public async deleteAllFiles(): Promise<void> {
    const res: DeleteResult = await this.model
      .deleteMany({})
      .exec();
    const count = await this.model.count();
    if (count !== 0) {
      throw new InternalServerErrorException(
        'Some files could not be deleted.',
      );
    }
  }
  */

  public async deleteSimulationRunFiles(runId: string): Promise<void> {
    const files = await this.model
      .find({ simulationRun: runId })
      .select('location')
      .exec();

    await Promise.all(
      files.map((file) => {
        return this.deleteFile(runId, file.location);
      })
    );
  }

  public async deleteFile(runId: string, fileLocation: string): Promise<void> {
    const file = await this.model
      .findOne({
        $or: [
          { id: this.getFileId(runId, fileLocation, true) },
          { id: this.getFileId(runId, fileLocation, false) },
        ],
      })
      .select('id')
      .exec();
    if (!file) {
      throw new NotFoundException(
        `A file could not found for simulation run '${runId}' and location '${fileLocation}'.`,
      );
    }

    await this.storage.deleteObject(this.endpoints.getSimulationRunOutputS3Path(file.id));

    const res: DeleteResult = await this.model
      .deleteOne({ id: file.id })
      .exec();
    if (res.deletedCount !== 1) {
      throw new InternalServerErrorException('File could not be deleted.');
    }
  }

  private getFileId(
    runId: string,
    fileLocation: string,
    includeInitialRelPath = false,
  ): string {
    if (fileLocation.startsWith('./')) {
      fileLocation = fileLocation.substring(2);
    }
    return runId + '/' + (includeInitialRelPath ? './' : '') + fileLocation;
  }
}
