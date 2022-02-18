import { isUrl, ObjectIdValidator } from '@biosimulations/datamodel-database';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as SchemaType, Types } from 'mongoose';
import { SimulationRunModel } from '../simulation-run/simulation-run.model';
import { File, ThumbnailUrls } from '@biosimulations/datamodel/common';

@Schema({
  storeSubdocValidationError: false,
  strict: 'throw',
  _id: false,
  id: false,
})
class FileThumbnailUrlModel extends Document implements ThumbnailUrls {
  @Prop({
    required: false,
    validate: [isUrl],
  })
  public view?: string;

  @Prop({})
  public browse?: string;
}

export const FileThumbnailUrlSchema: SchemaType<FileThumbnailUrlModel> =
  SchemaFactory.createForClass(FileThumbnailUrlModel);

@Schema({
  storeSubdocValidationError: false,
  collection: 'Files',
  strict: 'throw',
})
export class FileModel extends Document implements File {
  @Prop({
    required: true,
    unique: true,
    index: true,
    immutable: true,
    sparse: false,
  })
  public id: string;

  @Prop({})
  public name: string;

  @Prop({
    type: Types.ObjectId,
    ref: SimulationRunModel.name,
    required: true,
    index: true,
    validate: ObjectIdValidator,
    immutable: true,
  })
  public simulationRun: string;

  @Prop({})
  public size: number;

  @Prop({})
  public format: string;

  @Prop({})
  public master: boolean;

  @Prop({})
  public url: string;

  @Prop({})
  public location!: string;

  @Prop({
    type: FileThumbnailUrlSchema,
  })
  public thumbnailUrls!: ThumbnailUrls;

  public created!: Date;
  public updated!: Date;

  public constructor(
    id: string,
    name: string,
    format: string,
    master: boolean,
    size: number,
    simulationRun: string,
    url: string,
  ) {
    super();
    this.id = id;
    this.url = url;
    this.name = name;
    this.format = format;
    this.master = master;
    this.simulationRun = simulationRun;
    this.size = size;
    this.thumbnailUrls = {
      browse: undefined,
      view: undefined,
    };
  }
}

export const FileModelSchema: SchemaType<FileModel> =
  SchemaFactory.createForClass(FileModel);
FileModelSchema.set('strict', 'throw');
FileModelSchema.set('timestamps', {
  createdAt: 'created',
  updatedAt: 'updated',
});
