/**
 * BioSimulations COMBINE service
 * Endpoints for working with models (e.g., [CellML](http://cellml.org/), [SBML](http://sbml.org/)), simulation experiments (e.g., [Simulation Experiment Description Language (SED-ML)](http://sed-ml.org/)), metadata ([OMEX Metadata](https://sys-bio.github.io/libOmexMeta/)), and simulation projects ([COMBINE/OMEX archives](https://combinearchive.org/)).  Note, this API may change significantly in the future.
 *
 * The version of the OpenAPI document: 0.1
 * Contact: info@biosimulations.org
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
import { SedTask } from './sedTask';
import { SedSimulation } from './sedSimulation';
import { SedOutput } from './sedOutput';
import { SedDataGenerator } from './sedDataGenerator';
import { SedModel } from './sedModel';

/**
 * A SED document.
 */
export interface SedDocument {
  /**
   * Outputs.
   */
  outputs: Array<SedOutput>;
  /**
   * Level.
   */
  level: number;
  /**
   * Version.
   */
  version: number;
  /**
   * Models.
   */
  models: Array<SedModel>;
  /**
   * Simulations.
   */
  simulations: Array<SedSimulation>;
  /**
   * Tasks.
   */
  tasks: Array<SedTask>;
  /**
   * Data generators.
   */
  dataGenerators: Array<SedDataGenerator>;
  /**
   * Type.
   */
  _type: SedDocumentType;
}
export enum SedDocumentType {
  SedDocument = 'SedDocument',
}
