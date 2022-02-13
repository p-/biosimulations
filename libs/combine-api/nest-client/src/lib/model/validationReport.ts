/**
 * BioSimulations COMBINE API
 * Endpoints for working with models (e.g., [CellML](https://cellml.org/), [SBML](http://sbml.org/)), simulation experiments (e.g., [Simulation Experiment Description Language (SED-ML)](https://sed-ml.org/)), metadata ([OMEX Metadata](https://sys-bio.github.io/libOmexMeta/)), and simulation projects ([COMBINE/OMEX archives](https://combinearchive.org/)).  Note, this API may change significantly in the future.
 *
 * The version of the OpenAPI document: 0.1
 * Contact: info@biosimulations.org
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
import { ValidationMessage } from './validationMessage';

/**
 * Information about whether a COMBINE/OMEX archive is valid, potentially invalid (1 or more warnings), or invalid (1 or more errors).
 */
export interface ValidationReport {
  /**
   * Errors with the archive.
   */
  errors?: Array<ValidationMessage>;
  /**
   * Overall status of the archive.
   */
  status: ValidationReportStatus;
  /**
   * Warnings for the archive.
   */
  warnings?: Array<ValidationMessage>;
  /**
   * Type
   */
  _type: ValidationReportTypeEnum;
}
export enum ValidationReportStatus {
  Valid = 'valid',
  Invalid = 'invalid',
  Warnings = 'warnings',
}
export enum ValidationReportTypeEnum {
  ValidationReport = 'ValidationReport',
}
