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
/* tslint:disable:no-unused-variable member-ordering */
import FormData from 'form-data';

import { HttpService, Inject, Injectable, Optional } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { Observable } from 'rxjs';
import { Environment } from '../model/environment';
import { SimulationRunResults } from '../model/simulationRunResults';
import { Simulator } from '../model/simulator';
import { Configuration } from '../configuration';

@Injectable()
export class SimulationExecutionService {
  protected basePath = 'https://combine.api.biosimulations.dev';
  public defaultHeaders = new Map();
  public configuration = new Configuration();

  constructor(protected httpClient: HttpService, @Optional() configuration: Configuration) {
    this.configuration = configuration || this.configuration;
    this.basePath = configuration?.basePath || this.basePath;
  }

  /**
   * @param consumes string[] mime-types
   * @return true: consumes contains 'multipart/form-data', false: otherwise
   */
  private canConsumeForm(consumes: string[]): boolean {
    const form = 'multipart/form-data';
    return consumes.includes(form);
  }

  /**
   * Get the simulators available to execute COMBINE/OMEX archives
   * Get the ids, vesions, and properties of simulators available to execute COMBINE/OMEX archives.
   * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
   * @param reportProgress flag to report request and response progress.
   */
  public srcHandlersRunGetSimulatorsHandler(): Observable<AxiosResponse<Array<Simulator>>>;
  public srcHandlersRunGetSimulatorsHandler(): Observable<any> {
    let headers: any = this.defaultHeaders;

    // to determine the Accept header
    let httpHeaderAccepts: string[] = ['application/json'];
    const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
    if (httpHeaderAcceptSelected != undefined) {
      headers['Accept'] = httpHeaderAcceptSelected;
    }

    // to determine the Content-Type header
    const consumes: string[] = [];
    return this.httpClient.get<Array<Simulator>>(`${this.basePath}/run/simulators`, {
      withCredentials: this.configuration.withCredentials,
      headers: headers,
    });
  }
  /**
   * Execute a COMBINE/OMEX archive
   * Execute the simulations defined in SED-ML format in a COMBINE/OMEX archive and return the result of each report and plot.
   * @param simulator Id of a simulation tool registered with BioSimulators.
   * @param type Type
   * @param archiveUrl URL
   * @param archiveFile The two files uploaded in creating a combine archive
   * @param environment
   * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
   * @param reportProgress flag to report request and response progress.
   */
  public srcHandlersRunRunHandler(
    simulator: string,
    type: string,
    archiveUrl?: string,
    archiveFile?: Blob,
    environment?: Environment,
  ): Observable<AxiosResponse<SimulationRunResults>>;
  public srcHandlersRunRunHandler(
    simulator: string,
    type: string,
    archiveUrl?: string,
    archiveFile?: Blob,
    environment?: Environment,
  ): Observable<any> {
    if (simulator === null || simulator === undefined) {
      throw new Error('Required parameter simulator was null or undefined when calling srcHandlersRunRunHandler.');
    }

    if (type === null || type === undefined) {
      throw new Error('Required parameter type was null or undefined when calling srcHandlersRunRunHandler.');
    }

    let headers: any = this.defaultHeaders;

    // to determine the Accept header
    let httpHeaderAccepts: string[] = ['application/json', 'application/x-hdf', 'application/zip'];
    const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
    if (httpHeaderAcceptSelected != undefined) {
      headers['Accept'] = httpHeaderAcceptSelected;
    }

    // to determine the Content-Type header
    const consumes: string[] = ['multipart/form-data'];

    const canConsumeForm = this.canConsumeForm(consumes);

    let formParams: FormData = new FormData();
    let useForm = false;
    let convertFormParamsToString = false;

    // use FormData to transmit files using content-type "multipart/form-data"
    // see https://stackoverflow.com/questions/4007969/application-x-www-form-urlencoded-or-multipart-form-data
    useForm = canConsumeForm;
    if (useForm) {
      formParams = new FormData();
      headers = formParams.getHeaders();
    } else {
      // formParams = new HttpParams({encoder: new CustomHttpUrlEncodingCodec()});
    }

    if (simulator !== undefined) {
      formParams.append('simulator', <any>simulator);
    }

    if (archiveUrl !== undefined) {
      formParams.append('archiveUrl', <any>archiveUrl);
    }

    if (archiveFile !== undefined) {
      formParams.append('archiveFile', <any>archiveFile);
    }

    if (type !== undefined) {
      formParams.append('_type', <any>type);
    }

    if (environment !== undefined) {
      formParams.append('environment', <any>environment);
    }

    return this.httpClient.post<SimulationRunResults>(
      `${this.basePath}/run/run`,
      convertFormParamsToString ? formParams.toString() : formParams,
      {
        withCredentials: this.configuration.withCredentials,
        headers: headers,
      },
    );
  }
}
