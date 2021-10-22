import { IImage, OperatingSystemType } from '@biosimulations/datamodel/common';
import { EdamOntologyIdVersion } from '../common';

import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsHash,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class Image implements IImage {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    description: 'URL for the image',
    example: 'ghcr.io/virtualcell/biosimulators_vcell:latest',
  })
  public url!: string;

  @IsNotEmpty()
  // TODO remove sha256 prefix from hash
  //@IsHash('sha256')
  @ApiProperty({
    type: String,
    description: 'Repository digest for the image',
    example:
      'sha256:5d1595553608436a2a343f8ab7e650798ef5ba5dab007b9fe31cd342bf18ec81',
    pattern: '^sha256:[a-z0-9]{64,64}$',
  })
  public digest!: string;

  @ValidateNested()
  @Type(() => EdamOntologyIdVersion)
  @ApiProperty({
    type: EdamOntologyIdVersion,
    description: 'Format of the image',
  })
  public format!: EdamOntologyIdVersion;

  @IsEnum(OperatingSystemType)
  @ApiProperty({
    type: String,
    enum: OperatingSystemType,
    nullable: true,
    description: 'Operating system in the image',
  })
  public operatingSystemType!: OperatingSystemType | null;
}
