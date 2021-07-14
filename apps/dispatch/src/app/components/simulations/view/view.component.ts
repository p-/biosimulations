import {
  Component,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  FormControl,
  Validators,
} from '@angular/forms';
import { MatTabChangeEvent } from '@angular/material/tabs';
import { SimulationService } from '../../../services/simulation/simulation.service';
import { SimulationStatusService } from '../../../services/simulation/simulation-status.service';
import { VisualizationService } from '../../../services/visualization/visualization.service';
import {
  PlotlyVisualizationComponent,
  AxisType,
  TraceType,
  TraceMode,
  Trace,
  DataLayout,
} from './plotly-visualization/plotly-visualization.component';
import { CombineService } from '../../../services/combine/combine.service';
import { DispatchService } from '../../../services/dispatch/dispatch.service';
import {
  Simulation,
  SedDatasetResultsMap,
} from '../../../datamodel';
import {
  CombineArchive,
  CombineArchiveContent,
  CombineArchiveContentFile,
  SedDocument,
  SedModel,
  SedSimulation,
  SedAbstractTask,
  SedDataGenerator,
  SedOutput,
  SedPlot2D,
  SedReport,
  SedDataSet,
} from '../../../combine-sedml.interface';
import { SimulationLogs } from '../../../simulation-logs-datamodel';
import { ConfigService } from '@biosimulations/shared/services';
import { BehaviorSubject, Observable, of, Subscription, combineLatest } from 'rxjs';
import { concatAll, map, shareReplay, withLatestFrom } from 'rxjs/operators';
import {
  AxisLabelType,
  AXIS_LABEL_TYPES,
  FormattedSimulation,
  TraceModeLabel,
  TRACE_MODE_LABELS,
} from './view.model';
import { ViewService } from './view.service';
import {
  Spec as VegaSpec,
  Format as VegaDataFormat,
} from 'vega';
import { VegaVisualizationComponent } from '@biosimulations/shared/ui';
import { MatSnackBar } from '@angular/material/snack-bar';
import { urls } from '@biosimulations/config/common';
import { CombineArchiveElementMetadata } from '../../../metadata.interface';

interface Metadata {
  archive: CombineArchiveElementMetadata | null;
  other: CombineArchiveElementMetadata[];
}

enum VisualizationSource {
  sedml = 'sedml',
  vega = 'vega',
  user = 'user',
}

enum VisualizationType {
  sedml = 'sedml',
  vega = 'vega',
  user1DHistogram = 'user1DHistogram',
  user2DHeatmap = 'user2DHeatmap',
  user2DLineScatter = 'user2DLineScatter',
}

enum VisualizationRenderer {
  vega = 'vega',
  plotly = 'plotly',
}

interface Visualization {
  id: string;
  source: VisualizationSource,
  type: VisualizationType,
  renderer: VisualizationRenderer,
  uri: string | undefined;
  label: string;
  vegaSpec: Observable<VegaSpec | undefined | false>;
  sedmlOutputSpec: SedPlot2D | undefined;
  error?: Error;
}

interface VegaDataSet {
  index: number;
  name: string;
  source: string | string[] | undefined;
  url: string | undefined;
  values: any[] | undefined;
  format: VegaDataFormat | undefined;
}

export interface SedDocumentReports {
  _type: 'SedDocument';
  level: number;
  version: number;
  models: SedModel[];
  simulations: SedSimulation[];
  tasks: SedAbstractTask[];
  dataGenerators: SedDataGenerator[];
  outputs: SedReport[];
}

export interface SedDocumentReportsCombineArchiveLocation {
  _type: 'CombineArchiveLocation';
  path: string;
  value: SedDocumentReports;
}

interface SedDocumentReportsCombineArchiveContent {
  _type: 'CombineArchiveContent';
  location: SedDocumentReportsCombineArchiveLocation;
  format: string;
  master: boolean;
}

@Component({
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.scss'],
  //this seems to be required oddly
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewComponent implements OnInit, OnDestroy {
  private uuid = '';

  // simulation run
  statusRunning$!: Observable<boolean>;
  statusSucceeded$!: Observable<boolean>;
  runTime$!: Observable<string>;
  private Simulation$!: Observable<Simulation>;
  formattedSimulation$?: Observable<FormattedSimulation>;

  // metadata about COMBINE/OMEX archive of simulation run
  metadataLoaded$!: Observable<boolean | undefined>;
  metadata$!: Observable<Metadata | undefined>;

  // SED documents in COMBINE/OMEX archive of simulation run
  sedDocumentReportsConfiguration$!: Observable<SedDocumentReportsCombineArchiveContent[]>;
  private sedDataSetConfigurationMap!: {[uri: string]: SedDataSet};

  // visualizations
  visualizationFormGroup: FormGroup;

  visualizations$!: Observable<Visualization[]>;
  private visualizationsMap!: {[id: string]: Visualization};
  selectedVisualization!: Visualization;

  @ViewChild(VegaVisualizationComponent)
  private vegaVisualization!: VegaVisualizationComponent;

  @ViewChild(PlotlyVisualizationComponent)
  private plotlyVisualization!: PlotlyVisualizationComponent;
  private plotlyVizDataLayout = new BehaviorSubject<DataLayout | null | false>(null);
  plotlyVizDataLayout$ = this.plotlyVizDataLayout.asObservable();

  user1DHistogramDataSetsFormControl: FormControl;
  user2DHeatmapYDataSetsFormControl: FormControl;
  user2DLineScatterCurvesFormGroups: FormGroup[];

  axisLabelTypes: AxisLabelType[] = AXIS_LABEL_TYPES;
  traceModeLabels: TraceModeLabel[] = TRACE_MODE_LABELS;

  private userSimulationResults: SedDatasetResultsMap | undefined | false = undefined;
  private userSimulationResultsLoaded = false;

  // log of simulation run
  logs$!: Observable<SimulationLogs | undefined>;

  // subscripts
  private subscriptions: Subscription[] = [];

  constructor(
    private config: ConfigService,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private service: ViewService,
    private combineService: CombineService,
    private simulationService: SimulationService,
    private visualizationService: VisualizationService,
    private dispatchService: DispatchService,
    private changeDetectorRef: ChangeDetectorRef,
    private snackBar: MatSnackBar,
  ) {
    this.visualizationFormGroup = formBuilder.group({
      visualization: [null, [Validators.required]],
      user1DHistogram: formBuilder.group({
        dataSets: [[], Validators.required],
      }),
      user2DHeatmap: formBuilder.group({
        yDataSets: [[], Validators.required],
        xDataSet: [null],
      }),
      user2DLineScatter: formBuilder.group({
        numCurves: [1, [Validators.required]],
        curves: formBuilder.array([]),
        xAxisType: [AxisType.linear, [Validators.required]],
        yAxisType: [AxisType.linear, [Validators.required]],
        traceMode: [TraceMode.lines, [Validators.required]],
      }),
    });

    const user1DHistogramFormGroup = this.visualizationFormGroup.controls.user1DHistogram as FormGroup;
    const user2DHeatmapFormGroup = this.visualizationFormGroup.controls.user2DHeatmap as FormGroup;
    const user2DLineScatterFormGroup = this.visualizationFormGroup.controls.user2DLineScatter as FormGroup;
    this.user1DHistogramDataSetsFormControl = user1DHistogramFormGroup.controls.dataSets as FormControl;
    this.user2DHeatmapYDataSetsFormControl = user2DHeatmapFormGroup.controls.yDataSets as FormControl;
    this.user2DLineScatterCurvesFormGroups = (user2DLineScatterFormGroup.controls.curves as FormArray).controls as FormGroup[];
  }

  public ngOnInit(): void {
    this.uuid = this.route.snapshot.params['uuid'];
    this.initSimulationRun();
    this.initSimulationProjectMetadata();
    this.initVisualizations();
    this.initSimulationRunLog();
  }

  initSimulationRun(): void {
    this.Simulation$ = this.simulationService
      .getSimulation(this.uuid)
      .pipe(shareReplay(1));

    this.formattedSimulation$ = this.Simulation$.pipe(
      map<Simulation, FormattedSimulation>(this.service.formatSimulation),
    );

    this.statusRunning$ = this.formattedSimulation$.pipe(
      map((value: FormattedSimulation): boolean => {
        return SimulationStatusService.isSimulationStatusRunning(value.status);
      }),
    );

    this.statusSucceeded$ = this.formattedSimulation$.pipe(
      map((value: FormattedSimulation): boolean => {
        return SimulationStatusService.isSimulationStatusSucceeded(
          value.status,
        );
      }),
    );
  }

  initSimulationProjectMetadata(): void {
    const archiveUrl = this.getArchiveUrl();
    this.metadata$ = this.combineService
      .getCombineArchiveMetadata(archiveUrl)
      .pipe(
        map(
          (
            elMetadatas: CombineArchiveElementMetadata[] | undefined,
          ): Metadata | undefined => {
            if (elMetadatas === undefined) {
              return undefined;
            }

            elMetadatas.forEach(
              (elMetadata: CombineArchiveElementMetadata): void => {
                elMetadata.thumbnails = elMetadata.thumbnails.map(
                  (thumbnail: string): string => {
                    return `${urls.combineApi}combine/file?url=${encodeURI(
                      archiveUrl,
                    )}&location=${encodeURI(thumbnail)}`;
                  },
                );

                if (elMetadata.created) {
                  const d = new Date(elMetadata.created);
                  elMetadata.created =
                    d.getFullYear() +
                    '-' +
                    ('0' + (d.getMonth() + 1)).slice(-2) +
                    '-' +
                    ('0' + d.getDate()).slice(-2);
                }
                elMetadata.modified = elMetadata.modified.map(
                  (date: string): string => {
                    const d = new Date(date);
                    return (
                      d.getFullYear() +
                      '-' +
                      ('0' + (d.getMonth() + 1)).slice(-2) +
                      '-' +
                      ('0' + d.getDate()).slice(-2)
                    );
                  },
                );
                elMetadata.modified.sort();
                elMetadata.modified.reverse();
              },
            );

            return {
              archive: elMetadatas.filter(
                (elMetadata: CombineArchiveElementMetadata): boolean => {
                  return elMetadata.uri === '.';
                },
              )?.[0],
              other: elMetadatas.filter(
                (elMetadata: CombineArchiveElementMetadata): boolean => {
                  return elMetadata.uri !== '.';
                },
              ),
            };
          },
        ),
        shareReplay(1),
      );
    this.metadataLoaded$ = this.metadata$.pipe(
      map((): boolean => {
        return true;
      }),
      shareReplay(1),
    );
  }

  initVisualizations(): void {
    const archiveUrl = `${urls.dispatchApi}run/${this.uuid}/download`;

    const archiveManifest = this.statusSucceeded$.pipe(
      map(
        (succeeded: boolean): Observable<CombineArchive | undefined> => {
          return succeeded
            ? this.combineService.getCombineArchiveManifest(
                archiveUrl,
              )
            : of({ _type: 'CombineArchive', contents: [] });
        }
      ),
      concatAll(),
      shareReplay(1),
    );

    const sedDocumentsConfiguration = this.statusSucceeded$.pipe(
      map(
        (succeeded: boolean): Observable<CombineArchive | undefined> => {
          return succeeded
            ? this.visualizationService.getSpecsOfSedDocsInCombineArchive(
                this.uuid,
              )
            : of({ _type: 'CombineArchive', contents: [] });
        }
      ),
      concatAll(),
      shareReplay(1),
    );

    this.sedDocumentReportsConfiguration$ = sedDocumentsConfiguration
      .pipe(
        map((archive: CombineArchive | undefined): SedDocumentReportsCombineArchiveContent[] => {
          if (archive) {
            archive = JSON.parse(JSON.stringify(archive)) as CombineArchive;
            archive.contents.forEach((content: CombineArchiveContent): void => {
              const sedDoc = content.location.value as SedDocument;
              sedDoc.outputs = sedDoc.outputs.filter((output: SedOutput): boolean => {
                return output._type === 'SedReport';
              });
            })
            return archive.contents as SedDocumentReportsCombineArchiveContent[];
          } else {
            return [];
          }
        }),
        shareReplay(1),
      );

    this.sedDocumentReportsConfiguration$.subscribe(
      (contents: SedDocumentReportsCombineArchiveContent[]): void => {
        this.sedDataSetConfigurationMap = {};
        contents.forEach((sedDoc: SedDocumentReportsCombineArchiveContent): void => {
          sedDoc.location.value.outputs.forEach((output: SedReport): void => {
            output.dataSets.forEach((dataSet: SedDataSet): void => {
              const uri = sedDoc.location.path + '/' + output.id + '/' + dataSet.id;
              this.sedDataSetConfigurationMap[uri] = dataSet;
            })
          })
        })
      });

    this.visualizations$ = combineLatest(this.statusSucceeded$, archiveManifest, sedDocumentsConfiguration)
      .pipe(
        map((
          args: [
            boolean,
            CombineArchive | undefined,
            CombineArchive | undefined,
          ],
        ): Visualization[] => {
          const succeeded = args[0];
          const manifest = args[1];
          const sedmlSpecs = args[2];

          const visualizations: Visualization[] = [];
          if (succeeded && manifest && sedmlSpecs) {
            for (const content of manifest.contents) {
              if (content.format == 'http://purl.org/NET/mediatypes/application/vega+json') {
                visualizations.push({
                  id: 'vega/' + (content.location.value as CombineArchiveContentFile).filename,
                  source: VisualizationSource.vega,
                  type: VisualizationType.vega,
                  renderer: VisualizationRenderer.vega,
                  uri: (content.location.value as CombineArchiveContentFile).filename,
                  label: (content.location.value as CombineArchiveContentFile).filename + ' (Vega)',
                  vegaSpec: of(undefined),
                  sedmlOutputSpec: undefined,
                });
              }
            }

            for (const content of sedmlSpecs.contents) {
              const sedDocument = content.location.value as SedDocument;
              for (const output of sedDocument.outputs) {
                if (['SedPlot2D'].includes(output._type)) {
                  visualizations.push({
                    id: `sedml/${content.location.path}/${output.id}`,
                    source: VisualizationSource.sedml,
                    type: VisualizationType.sedml,
                    renderer: VisualizationRenderer.plotly,
                    uri: `${content.location.path}/${output.id}`,
                    label: `${output.name || output.id} of ${content.location.path} (SED-ML 2D line plot)`,
                    vegaSpec: of(undefined),
                    sedmlOutputSpec: output as SedPlot2D,
                  });
                }
              }
            }

            visualizations.push({
              id: `user1DHistogram`,
              source: VisualizationSource.user,
              type: VisualizationType.user1DHistogram,
              renderer: VisualizationRenderer.plotly,
              uri: undefined,
              label: 'Design a 1D histogram',
              vegaSpec: of(undefined),
              sedmlOutputSpec: undefined,
            });

            visualizations.push({
              id: `user2DHeatmap`,
              source: VisualizationSource.user,
              type: VisualizationType.user2DHeatmap,
              renderer: VisualizationRenderer.plotly,
              uri: undefined,
              label: 'Design a 2D heatmap',
              vegaSpec: of(undefined),
              sedmlOutputSpec: undefined,
            });

            visualizations.push({
              id: `user2DLineScatter`,
              source: VisualizationSource.user,
              type: VisualizationType.user2DLineScatter,
              renderer: VisualizationRenderer.plotly,
              uri: undefined,
              label: 'Design a 2D line or scatter plot',
              vegaSpec: of(undefined),
              sedmlOutputSpec: undefined,
            });
          }

          this.visualizationsMap = {};
          for (const visualization of visualizations) {
            this.visualizationsMap[visualization.id] = visualization;
          }

          if (visualizations.length) {
            const visualizationFormControl = this.visualizationFormGroup.controls.visualization as FormControl;
            visualizationFormControl.setValue(visualizations[0].id);
            this.selectVisualization();
          }

          visualizations.sort(
            (a: Visualization, b: Visualization): number => {
              let aSource = 0;
              let bSource = 0;
              switch (a.source) {
                case VisualizationSource.vega: aSource = 0; break;
                case VisualizationSource.sedml: aSource = 1; break;
                default: aSource = 2; break;
              }
              switch (b.source) {
                case VisualizationSource.vega: bSource = 0; break;
                case VisualizationSource.sedml: bSource = 1; break;
                default: bSource = 2; break;
              }

              if (aSource < bSource) {
                return -1;
              }
              if (aSource > bSource) {
                return 1;
              }

              return a.label.localeCompare(b.label, undefined, { numeric: true });
            });
          return visualizations;
        }),
        shareReplay(1),
      );
  }

  initSimulationRunLog(): void {
    this.logs$ = this.statusRunning$.pipe(
      map(
        (running: boolean): Observable<SimulationLogs | undefined> =>
          running
            ? of<undefined>(undefined)
            : this.dispatchService.getSimulationLogs(this.uuid),
      ),
      concatAll(),
      shareReplay(1),
    );

    const runningLogSub = this.logs$
      .pipe(withLatestFrom(this.statusRunning$))
      .subscribe((runningLog: [SimulationLogs | undefined, boolean]): void => {
        const log = runningLog[0];
        const running = runningLog[1];
        if (!running && !log) {
          this.snackBar.open(
            'Sorry! We were unable to get the log for this simulation.',
            undefined,
            {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            },
          );
        }
      });
    this.subscriptions.push(runningLogSub);

    this.runTime$ = this.logs$.pipe(
      map((log: SimulationLogs | undefined): string => {
        const duration = log?.structured?.duration;
        return duration == null
          ? 'N/A'
          : (Math.round(duration * 1000) / 1000).toString() + ' s';
      }),
      shareReplay(1),
    );
  }

  getArchiveUrl(): string {
    return `${urls.dispatchApi}run/${this.uuid}/download`;
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  public selectVisualization(): void {
    this.selectedVisualization = this.visualizationsMap?.[this.visualizationFormGroup.value.visualization];
    if (this.selectedVisualization) {
      switch (this.selectedVisualization.type) {
        case VisualizationType.vega: {
          this.setUpVegaVisualization();
          break;
        }
        case VisualizationType.sedml: {
          this.setUpSedmlVisualization();
          break;
        }
        case VisualizationType.user1DHistogram: {
          this.setUpUser1DHistogramVisualization();
          break;
        }
        case VisualizationType.user2DHeatmap: {
          this.setUpUser2DHeatmapVisualization();
          break;
        }
        case VisualizationType.user2DLineScatter: {
          this.setUpUser2DLineScatterVisualization();
          break;
        }
      }
    }
  }

  /* Vega visualization */
  private setUpVegaVisualization(): void {
    const visualization = this.selectedVisualization;

    const archiveUrl = this.getArchiveUrl();

    visualization.vegaSpec = this.combineService
      .getFileInCombineArchive(archiveUrl, visualization.uri as string)
      .pipe(
        map((spec: VegaSpec | undefined): VegaSpec | false => {
          if (spec) {
            const datas = spec.data;
            if (Array.isArray(datas)) {
              (datas as any[]).forEach((data: any, iData: number): void => {
                const name = data?.name;
                if (data?.sedml) {
                  data.url = this.visualizationService.getOutputResultsUrl(
                    this.uuid,
                    data?.sedml as string,
                  );
                  data.format = {
                    type: 'json',
                    property: 'data',
                  };
                  delete data['sedml'];
                  if ('values' in data) {
                    delete data['values'];
                  }
                }
              });
            }
            return spec;
          } else {
            return false;
          }
        }),
        shareReplay(1),
      );
  }

  /* SED-ML visualization */
  private setUpSedmlVisualization(): void {
    const visualization = this.selectedVisualization;
    this.plotlyVizDataLayout.next(null);

    const sub = this.visualizationService
      .getCombineResults(this.uuid) // TODO: replace with the following line when #2683 is fixed
      // .getCombineResults(this.uuid, visualization.uri as string)
      .subscribe((results: SedDatasetResultsMap | undefined): void => {
        if (results) {
          const traces: Trace[] = [];
          const xAxisTitlesSet = new Set<string>();
          const yAxisTitlesSet = new Set<string>();
          const output = visualization.sedmlOutputSpec as SedPlot2D;
          let missingData = false;
          for (const curve of output.curves) {
            const xId = curve.xDataGenerator._resultsDataSetId;
            const yId = curve.yDataGenerator._resultsDataSetId;
            xAxisTitlesSet.add(curve.xDataGenerator.name || curve.xDataGenerator.id);
            yAxisTitlesSet.add(curve.yDataGenerator.name || curve.yDataGenerator.id);
            const trace = {
              name: curve.name || curve.id,
              x: results?.[xId]?.values,
              y: results?.[yId]?.values,
              xaxis: 'x1',
              yaxis: 'y1',
              type: TraceType.scatter,
              mode: TraceMode.lines,
            };
            if (trace.x && trace.y) {
              traces.push(trace as Trace);
            } else {
              missingData = true;
            }
          }

          const xAxisTitlesArr = Array.from(xAxisTitlesSet);
          const yAxisTitlesArr = Array.from(yAxisTitlesSet);
          let xAxisTitle: string | undefined = undefined;
          let yAxisTitle: string | undefined = undefined;
          let showLegend = false;

          if (xAxisTitlesArr.length == 1) {
            xAxisTitle = xAxisTitlesArr[0];
          } else if (xAxisTitlesArr.length > 1) {
            xAxisTitle = 'Multiple';
            showLegend = true;
          }

          if (yAxisTitlesArr.length == 1) {
            yAxisTitle = yAxisTitlesArr[0];
          } else if (yAxisTitlesArr.length > 1) {
            yAxisTitle = 'Multiple';
            showLegend = true;
          }

          const dataLayout = {
            data: traces,
            layout: {
              xaxis1: {
                anchor: 'x1',
                title: xAxisTitle,
                type: output.xScale,
              },
              yaxis1: {
                anchor: 'y1',
                title: yAxisTitle,
                type: output.yScale,
              },
              grid: {
                rows: 1,
                columns: 1,
                pattern: 'independent',
              },
              showlegend: showLegend,
              width: undefined,
              height: undefined,
            }
          } as DataLayout;
          if (missingData) {
            this.plotlyVizDataLayout.next(false);
          } else {
            this.plotlyVizDataLayout.next(dataLayout);
          }
        } else {
          this.plotlyVizDataLayout.next(false);
        }
      });
    this.subscriptions.push(sub);
  }

  /* User-defined visualization */
  private setUpUser1DHistogramVisualization() {
    this.getUserSimulationResults();
    this.displayUser1DHistogram();
  }

  private setUpUser2DHeatmapVisualization() {
    this.getUserSimulationResults();
    this.displayUser2DHeatmap();
  }

  private setUpUser2DLineScatterVisualization() {
    this.getUserSimulationResults();
    this.setNum2DLineScatterCurves();
    this.displayUser2DLineScatterViz();
  }

  private getUserSimulationResults(): void {
    if (!this.userSimulationResultsLoaded) {
      this.userSimulationResultsLoaded = true;
      this.visualizationService.getCombineResults(this.uuid)
        .subscribe((results: SedDatasetResultsMap | undefined): void => {
          this.userSimulationResults = results || false;
          if (this.selectedVisualization.source == VisualizationSource.user) {
            this.selectVisualization();
          }
        });
    }
  }

  public setSelectedDataSets(
    formControl: FormControl,
    type: 'SedDocument' | 'SedReport' | 'SedDataSet',
    sedDocument: SedDocumentReportsCombineArchiveContent,
    sedDocumentId: string,
    report?: SedReport,
    reportId?: string,
    dataSet?: SedDataSet,
    dataSetId?: string,
  ): void {
    // const formGroup = this.visualizationFormGroup.controls.user1DHistogram as FormGroup;
    // const formControl = formGroup.controls.dataSets as FormControl;
    const selectedUris = new Set(formControl.value);

    const uri = sedDocumentId
      + (reportId ? '/' + reportId : '')
      + (dataSetId ? '/' + dataSetId : '');
    const selected = selectedUris.has(uri);

    if (type === 'SedDocument') {
      sedDocument.location.value.outputs.forEach((report: SedReport): void => {
        const reportUri = uri + '/' + report.id;
        if (selected) {
          selectedUris.add(reportUri);
        } else {
          selectedUris.delete(reportUri);
        }

        report.dataSets.forEach((dataSet: SedDataSet): void => {
          const dataSetUri = reportUri + '/' + dataSet.id;
          if (selected) {
            selectedUris.add(dataSetUri);
          } else {
            selectedUris.delete(dataSetUri);
          }
        });
      });

    } else if (type === 'SedReport') {
      if (!selected) {
        selectedUris.delete(sedDocumentId);
      }

      (report as SedReport).dataSets.forEach((dataSet: SedDataSet): void => {
        const dataSetUri = uri + '/' + dataSet.id;
        if (selected) {
          selectedUris.add(dataSetUri);
        } else {
          selectedUris.delete(dataSetUri);
        }
      });

      let hasAllReports = true;
      for (const report of sedDocument.location.value.outputs) {
        const reportUri = sedDocumentId + '/' + (report as SedReport).id;
        if (!selectedUris.has(reportUri)) {
          hasAllReports = false;
          break;
        }
      }
      if (hasAllReports) {
        selectedUris.add(sedDocumentId);
      }

    } else {
      if (selected) {
        let hasAllDataSets = true;
        for (const dataSet of (report as SedReport).dataSets) {
          const dataSetUri = sedDocumentId + '/' + (report as SedReport).id + '/' + dataSet.id;
          if (!selectedUris.has(dataSetUri)) {
            hasAllDataSets = false;
            break;
          }
        }
        if (hasAllDataSets) {
          selectedUris.add(sedDocumentId + '/' + (reportId as string));
        }

        let hasAllReports = true;
        for (const report of sedDocument.location.value.outputs) {
          const reportUri = sedDocumentId + '/' + (report as SedReport).id;
          if (!selectedUris.has(reportUri)) {
            hasAllReports = false;
            break;
          }
        }
        if (hasAllReports) {
          selectedUris.add(sedDocumentId);
        }

      } else {
        selectedUris.delete(sedDocumentId + '/' + (reportId as string));
        selectedUris.delete(sedDocumentId);
      }
    }

    formControl.setValue(Array.from(selectedUris));
    this.displayUserViz();
  }

  public setNum2DLineScatterCurves(): void {
    const formGroup = this.visualizationFormGroup.controls.user2DLineScatter as FormGroup;
    const numCurves = formGroup.value.numCurves;
    const curvesFormArray = formGroup.controls.curves as FormArray;

    while (curvesFormArray.length > numCurves) {
      curvesFormArray.removeAt(curvesFormArray.length - 1);
    }

    while (curvesFormArray.length < numCurves) {
      const curve = this.formBuilder.group({
        name: [null],
        xData: [null, [Validators.required]],
        yData: [null, [Validators.required]],
      });
      curvesFormArray.push(curve);
    }
  }

  public displayUserViz(): void {
    switch (this.selectedVisualization.type) {
      case VisualizationType.user1DHistogram: {
        this.displayUser1DHistogram();
        break;
      }
      case VisualizationType.user2DHeatmap: {
        this.displayUser2DHeatmap();
        break;
      }
      case VisualizationType.user2DLineScatter: {
        this.displayUser2DLineScatterViz();
        break;
      }
    }
  }

  private displayUser1DHistogram(): void {
    if (this.userSimulationResults) {
      const formGroup = this.visualizationFormGroup.controls.user1DHistogram as FormGroup;
      const formControl = formGroup.controls.dataSets as FormControl;
      const selectedUris = formControl.value;

      let allData: any = [];
      let missingData = false;
      const xAxisTitles: string[] = [];
      for (let selectedUri of selectedUris) {
        if (selectedUri.startsWith('./')) {
          selectedUri = selectedUri.substring(2);
        }

        const selectedDataSet = this.sedDataSetConfigurationMap?.[selectedUri];
        if (selectedDataSet) {
          const data = this.userSimulationResults?.[selectedUri];
          if (data) {
            allData = allData.concat(this.flattenArray(data.values));
            xAxisTitles.push(data.label);
          } else {
            missingData = true;
            break;
          }
        }
      }

      const trace = {
        x: allData,
        xaxis: 'x1',
        yaxis: 'y1',
        type: TraceType.histogram,
      };

      let xAxisTitle: string | undefined = undefined;
      if (xAxisTitles.length === 1) {
        xAxisTitle = xAxisTitles[0];
      } else if (xAxisTitles.length > 1) {
        xAxisTitle = 'Multiple';
      }

      const dataLayout = {
        data: [trace],
        layout: {
          xaxis1: {
            anchor: 'x1',
            title: xAxisTitle,
            type: 'linear',
          },
          yaxis1: {
            anchor: 'y1',
            title: 'Frequency',
            type: 'linear',
          },
          grid: {
            rows: 1,
            columns: 1,
            pattern: 'independent',
          },
          showlegend: false,
          width: undefined,
          height: undefined,
        }
      } as DataLayout;

      if (missingData) {
        this.plotlyVizDataLayout.next(false);
      } else {
        this.plotlyVizDataLayout.next(dataLayout);
      }
    } else if (this.userSimulationResults === undefined) {
      this.plotlyVizDataLayout.next(null);
    } else {
      this.plotlyVizDataLayout.next(false);
    }
  }

  private flattenArray(nestedArray: any[]): any[] {
    const flattenedArray: any[] = [];
    const toFlatten = [...nestedArray];
    while (toFlatten.length) {
      const el = toFlatten.pop();
      if (Array.isArray(el)) {
        toFlatten.push(el);
      } else {
        flattenedArray.push(el);
      }
    }
    return flattenedArray;
  }

  private displayUser2DHeatmap(): void {
    if (this.userSimulationResults) {
      const formGroup = this.visualizationFormGroup.controls.user2DHeatmap as FormGroup;
      const yFormControl = formGroup.controls.yDataSets as FormControl;
      const xFormControl = formGroup.controls.xDataSet as FormControl;
      const selectedYUris = yFormControl.value;
      const selectedXUri = xFormControl.value;

      let missingData = false;

      let zData: any[][] = [];
      const yTicks: string[] = [];
      for (let selectedUri of selectedYUris) {
        if (selectedUri.startsWith('./')) {
          selectedUri = selectedUri.substring(2);
        }

        const selectedDataSet = this.sedDataSetConfigurationMap?.[selectedUri];
        if (selectedDataSet) {
          const data = this.userSimulationResults?.[selectedUri];
          if (data) {
            const flattenedData = this.flattenArray(data.values);
            zData.push(flattenedData);
            yTicks.push(data.label);
          } else {
            missingData = true;
            break;
          }
        }
      }

      let xTicks: any[] | undefined = undefined;
      let xAxisTitle: string | undefined = undefined;
      if (selectedXUri) {
        const data = this.userSimulationResults?.[selectedXUri];
        if (data) {
          xTicks = this.flattenArray(data.values);
          xAxisTitle = data.label;
        } else {
          missingData = true;
        }
      }

      zData.reverse();
      yTicks.reverse();

      const trace = {
        z: zData,
        y: yTicks,
        x: xTicks,
        xaxis: 'x1',
        yaxis: 'y1',
        type: TraceType.heatmap,
        hoverongaps: false,
      };

      const dataLayout = {
        data: [trace],
        layout: {
          xaxis1: {
            anchor: 'x1',
            title: xAxisTitle,
            type: 'linear',
          },
          //yaxis1: {
          //  anchor: 'y1',
          //  title: undefined,
          //  type: 'linear',
          //},
          grid: {
            rows: 1,
            columns: 1,
            pattern: 'independent',
          },
          showlegend: false,
          width: undefined,
          height: undefined,
        }
      } as DataLayout;

      if (missingData) {
        this.plotlyVizDataLayout.next(false);
      } else {
        this.plotlyVizDataLayout.next(dataLayout);
      }
    } else if (this.userSimulationResults === undefined) {
      this.plotlyVizDataLayout.next(null);
    } else {
      this.plotlyVizDataLayout.next(false);
    }
  }

  private displayUser2DLineScatterViz(): void {
    if (this.userSimulationResults) {
      const formGroup = this.visualizationFormGroup.controls.user2DLineScatter as FormGroup;
      const traceMode = (formGroup.controls.traceMode as FormControl).value;

      const traces = [];
      const xAxisTitlesSet = new Set<string>();
      const yAxisTitlesSet = new Set<string>();
      let missingData = false;

      for (const curve of this.user2DLineScatterCurvesFormGroups) {
        const xDataUri = (curve.controls.xData as FormControl).value;
        const yDataUri = (curve.controls.yData as FormControl).value;
        if (xDataUri && yDataUri) {
          const xDataSet = this.sedDataSetConfigurationMap[xDataUri];
          const yDataSet = this.sedDataSetConfigurationMap[yDataUri];
          const xLabel = xDataSet.name || xDataSet.label || xDataSet.id;
          const yLabel = yDataSet.name || yDataSet.label || yDataSet.id;
          const name = (curve.controls.name as FormControl).value || `${yLabel} vs ${xLabel}`;

          const trace = {
            name: name,
            x: this.userSimulationResults?.[xDataUri]?.values,
            y: this.userSimulationResults?.[yDataUri]?.values,
            xaxis: 'x1',
            yaxis: 'y1',
            type: TraceType.scatter,
            mode: traceMode,
          }

          if (trace.x && trace.y) {
            traces.push(trace);
            xAxisTitlesSet.add(xLabel);
            yAxisTitlesSet.add(yLabel);
          } else if (xDataUri && yDataUri) {
            missingData = true;
          }
        }
      }

      const xAxisTitlesArr = Array.from(xAxisTitlesSet);
      const yAxisTitlesArr = Array.from(yAxisTitlesSet);

      let xAxisTitle: string | undefined = undefined;
      let yAxisTitle: string | undefined = undefined;

      if (xAxisTitlesArr.length === 1) {
        xAxisTitle = xAxisTitlesArr[0];
      } else if (xAxisTitlesArr.length > 1) {
        xAxisTitle = 'Multiple';
      }

      if (yAxisTitlesArr.length === 1) {
        yAxisTitle = yAxisTitlesArr[0];
      } else if (yAxisTitlesArr.length > 1) {
        yAxisTitle = 'Multiple';
      }

      const dataLayout = {
        data: traces,
        layout: {
          xaxis1: {
            anchor: 'x1',
            title: xAxisTitle,
            type: (formGroup.controls.xAxisType as FormControl).value,
          },
          yaxis1: {
            anchor: 'y1',
            title: yAxisTitle,
            type: (formGroup.controls.yAxisType as FormControl).value,
          },
          grid: {
            rows: 1,
            columns: 1,
            pattern: 'independent',
          },
          showlegend: traces.length > 1,
          width: undefined,
          height: undefined,
        }
      } as DataLayout;

      if (missingData) {
        this.plotlyVizDataLayout.next(false);
      } else {
        this.plotlyVizDataLayout.next(dataLayout);
      }
    } else if (this.userSimulationResults === undefined) {
      this.plotlyVizDataLayout.next(null);
    } else {
      this.plotlyVizDataLayout.next(false);
    }
  }

  /* tabs */
  private iVisualizationTab = 3;

  public selectedTabChange($event: MatTabChangeEvent): void {
    if ($event.index == this.iVisualizationTab) {
      if (this.plotlyVisualization) {
        this.plotlyVisualization.setLayout();
      }
      if (this.vegaVisualization) {
        this.vegaVisualization.render();
      }
      this.changeDetectorRef.detectChanges();
    }
  }
}
