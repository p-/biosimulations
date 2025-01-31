import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { BrowseService } from './browse.service';
import { FormattedProjectSummary, LocationPredecessor } from './browse.model';
import { Column, ColumnFilterType } from '@biosimulations/shared/ui';
import { FormatService } from '@biosimulations/shared/services';
import { LabeledIdentifier, DescribedIdentifier } from '@biosimulations/datamodel/common';
import { RowService } from '@biosimulations/shared/ui';
import { ScrollService } from '@biosimulations/shared/angular';

@Component({
  selector: 'biosimulations-projects-browse',
  templateUrl: './browse.component.html',
  styleUrls: ['./browse.component.scss'],
})
export class BrowseComponent implements OnInit, AfterViewInit {
  public projects$!: Observable<FormattedProjectSummary[]>;

  public columns: Column[] = [
    {
      id: 'id',
      key: 'id',
      heading: 'Id',
      leftIcon: 'id',
      filterable: false,
      hidden: true,
      show: false,
    },
    {
      id: 'title',
      key: 'title',
      heading: 'Title',
      leftIcon: 'file',
      filterable: false,
      hidden: true,
      show: false,
    },
    {
      id: 'abstract',
      key: ['metadata', 'abstract'],
      heading: 'Abstract',
      leftIcon: 'file',
      filterable: false,
      hidden: false,
      show: true,
    },
    {
      id: 'description',
      key: ['metadata', 'description'],
      heading: 'Description',
      leftIcon: 'file',
      filterable: false,
      hidden: false,
      show: false,
    },
    {
      id: 'biology',
      key: ['metadata', 'encodes'],
      heading: 'Biology',
      leftIcon: 'cell',
      filterable: true,
      hidden: false,
      show: true,
      getter: (project: FormattedProjectSummary): string[] => {
        return project.metadata.encodes.map((v: LabeledIdentifier) => v.label || v.uri) as string[];
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return project.metadata.encodes
          .map((v: LabeledIdentifier) => {
            if (!v.label && v.uri) {
              return this.processUriForSearch(v.uri);
            } else {
              return '';
            }
          })
          .join(' ');
      },
    },
    {
      id: 'taxa',
      key: ['metadata', 'taxa'],
      heading: 'Taxa',
      leftIcon: 'taxon',
      filterable: true,
      hidden: false,
      show: true,
      getter: (project: FormattedProjectSummary): string[] => {
        return project.metadata.taxa.map((v: LabeledIdentifier) => v.label || v.uri) as string[];
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return project.metadata.taxa
          .map((v: LabeledIdentifier) => {
            if (!v.label && v.uri) {
              return this.processUriForSearch(v.uri);
            } else {
              return '';
            }
          })
          .join(' ');
      },
    },
    {
      id: 'keywords',
      key: ['metadata', 'keywords'],
      heading: 'Keywords',
      leftIcon: 'tag',
      filterable: true,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string[] => {
        return project.metadata.keywords.map((v: LabeledIdentifier) => v.label) as string[];
      },
    },
    {
      id: 'citations',
      key: ['metadata', 'citations'],
      heading: 'Citations',
      leftIcon: 'journal',
      filterable: true,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string[] => {
        return project.metadata.citations.map((v: LabeledIdentifier) => v.label || v.uri) as string[];
      },
      filterGetter: (project: FormattedProjectSummary): string => {
        return project.metadata.citations.length > 0 ? 'Yes' : 'No';
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return project.metadata.citations
          .map((v: LabeledIdentifier) => {
            if (!v.label && v.uri) {
              return this.processUriForSearch(v.uri);
            } else {
              return '';
            }
          })
          .join(' ');
      },
    },
    {
      id: 'identifiers',
      key: ['metadata', 'identifiers'],
      heading: 'Identifiers',
      leftIcon: 'id',
      filterable: false,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string[] => {
        return project.metadata.identifiers.map((v: LabeledIdentifier) => v.label || v.uri) as string[];
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return project.metadata.identifiers
          .map((v: LabeledIdentifier) => {
            if (!v.label && v.uri) {
              return this.processUriForSearch(v.uri);
            } else {
              return '';
            }
          })
          .join(' ');
      },
    },
    {
      id: 'other',
      key: ['metadata', 'other'],
      heading: 'Additional metadata',
      leftIcon: 'info',
      filterable: false,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string[] => {
        return project.metadata.other.map((v: DescribedIdentifier) => {
          return (v.attribute_label || v.attribute_uri || '') + ': ' + (v.label || v.uri || '');
        }) as string[];
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return project.metadata.other
          .map((v: DescribedIdentifier) => {
            let val = '';
            if (!v.attribute_label && v.attribute_uri) {
              val += this.processUriForSearch(v.attribute_uri);
            }
            if (!v.label && v.uri) {
              val += this.processUriForSearch(v.uri);
            }
            return val;
          })
          .join(' ');
      },
    },
    // sources
    // predecessors
    // successors
    // seeAlso
    // references
    {
      id: 'modelFormats',
      key: 'tasks',
      heading: 'Model formats',
      leftIcon: 'format',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): string[] => {
        return Array.from(
          new Set(
            project.tasks.map((task): string => {
              return task.model.language.acronym || task.model.language.name || task.model.language.sedmlUrn;
            }),
          ),
        ).sort();
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        const vals = new Set<string>();
        project.tasks.forEach((task): void => {
          if (task.model.language.acronym && task.model.language.name) {
            vals.add(task.model.language.name);
          }
          if (task.model.language.edamId) {
            vals.add(task.model.language.edamId);
          }
          vals.add(task.model.language.sedmlUrn);
        });
        return Array.from(vals).join(' ');
      },
    },
    {
      id: 'simulationTypes',
      key: 'tasks',
      heading: 'Simulation types',
      leftIcon: 'framework',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): string[] => {
        return Array.from(
          new Set(
            project.tasks.map((task): string => {
              const sedmlLength = 'SED-ML'.length;
              return (
                task.simulation.type.name.substring(sedmlLength + 1, sedmlLength + 2).toUpperCase() +
                task.simulation.type.name.substring(
                  sedmlLength + 2,
                  task.simulation.type.name.length - ' simulation'.length,
                )
              );
            }),
          ),
        ).sort();
      },
    },
    {
      id: 'simulationAlgorithms',
      key: 'tasks',
      heading: 'Simulation algorithms',
      leftIcon: 'framework',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): string[] => {
        return Array.from(
          new Set(
            project.tasks.map((task): string => {
              return task.simulation.algorithm.name || task.simulation.algorithm.kisaoId;
            }),
          ),
        ).sort();
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return Array.from(
          new Set(
            project.tasks.map((task): string => {
              return task.simulation.algorithm.kisaoId;
            }),
          ),
        ).join(' ');
      },
    },
    {
      id: 'simulator',
      key: ['simulationRun', 'simulatorName'],
      heading: 'Simulation tools',
      leftIcon: 'simulator',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): string => {
        return project.simulationRun.simulatorName + ' ' + project.simulationRun.simulatorVersion;
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return project.simulationRun.simulator;
      },
    },
    {
      id: 'reports',
      key: 'outputs',
      heading: 'Reports',
      leftIcon: 'report',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): string => {
        for (const output of project.outputs) {
          if (output.type.id === 'SedReport') {
            return 'Yes';
          }
        }
        return 'No';
      },
    },
    {
      id: 'visualizations',
      key: 'outputs',
      heading: 'Visualizations',
      leftIcon: 'chart',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): string[] => {
        return Array.from(
          new Set(
            project.outputs
              .filter((output): boolean => {
                return output.type.id !== 'SedReport';
              })
              .map((output): string => {
                return output.type.name;
              }),
          ),
        ).sort();
      },
    },
    {
      id: 'projectSize',
      key: ['simulationRun', 'projectSize'],
      heading: 'Project size',
      leftIcon: 'disk',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): number => {
        return project.simulationRun.projectSize / 1e6;
      },
      formatter: (value: number): string => {
        return FormatService.formatDigitalSize(value * 1e6);
      },
      filterType: ColumnFilterType.number,
      units: 'MB',
    },
    {
      id: 'cpus',
      key: ['simulationRun', 'cpus'],
      heading: 'CPUs',
      leftIcon: 'processor',
      hidden: false,
      show: false,
      filterable: true,
      filterType: ColumnFilterType.number,
    },
    {
      id: 'memory',
      key: ['simulationRun', 'memory'],
      heading: 'Memory',
      leftIcon: 'memory',
      hidden: false,
      show: false,
      filterable: true,
      formatter: (value: number): string => {
        return FormatService.formatDigitalSize(value);
      },
      filterType: ColumnFilterType.number,
      units: 'GB',
    },
    {
      id: 'resultsSize',
      key: ['simulationRun', 'resultsSize'],
      heading: 'Results size',
      leftIcon: 'disk',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): number => {
        return project.simulationRun.resultsSize / 1e6;
      },
      formatter: (value: number): string => {
        return FormatService.formatDigitalSize(value * 1e6);
      },
      filterType: ColumnFilterType.number,
      units: 'MB',
    },
    {
      id: 'runtime',
      key: ['simulationRun', 'runtime'],
      heading: 'Runtime',
      leftIcon: 'duration',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): number => {
        return project.simulationRun.runtime / 60;
      },
      formatter: (value: number): string => {
        return FormatService.formatDuration(value * 60);
      },
      filterType: ColumnFilterType.number,
      units: 'min',
    },
    {
      id: 'simulationProvenance',
      key: ['metadata', 'locationPredecessors'],
      heading: 'Simulation provenance',
      leftIcon: 'backward',
      hidden: false,
      show: false,
      filterable: true,
      getter: (project: FormattedProjectSummary): string[] => {
        const value = new Set(
          project.metadata.locationPredecessors
            .filter((locationPredecessor: LocationPredecessor): boolean => {
              return locationPredecessor.location.endsWith('.sedml');
            })
            .map((predecessor: LocationPredecessor): string => {
              return predecessor.predecessor.uri?.startsWith('http://omex-library.org/') &&
                predecessor.predecessor.uri.indexOf('.omex/') !== -1
                ? 'Simulation generated from model'
                : 'Other';
            }),
        );
        if (value.size === 0) {
          value.add('Other');
        }
        return Array.from(value);
      },
      filterComparator: (value: string, other: string, sign = 1): number => {
        if (value === 'Other') {
          if (other === 'Other') {
            return 0;
          } else {
            return sign;
          }
        } else {
          if (other === 'Other') {
            return -sign;
          } else {
            return RowService.comparator(value, other, sign);
          }
        }
      },
    },
    {
      id: 'organizations',
      key: ['owner', 'organizations'],
      heading: 'Organizations',
      leftIcon: 'organization',
      filterable: true,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string[] => {
        return project?.owner?.organizations?.map((organization) => organization.name) || ['None'];
      },
      extraSearchGetter: (project: FormattedProjectSummary): string | null => {
        return (project?.owner?.organizations?.map((organization) => organization.id) || ['None']).join(' ');
      },
      comparator: (value: string, other: string, sign = 1): number => {
        if (value === 'None') {
          if (other === 'None') {
            return 0;
          } else {
            return sign;
          }
        } else {
          if (other === 'None') {
            return -sign;
          } else {
            return RowService.comparator(value, other, sign);
          }
        }
      },
      filterComparator: (value: string, other: string, sign = 1): number => {
        if (value === 'None') {
          if (other === 'None') {
            return 0;
          } else {
            return sign;
          }
        } else {
          if (other === 'None') {
            return -sign;
          } else {
            return RowService.comparator(value, other, sign);
          }
        }
      },
    },
    {
      id: 'owner',
      key: 'owner',
      heading: 'Owner',
      leftIcon: 'author',
      filterable: true,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string => {
        return project?.owner?.name || 'Other';
      },
      extraSearchGetter: (project: FormattedProjectSummary): string | null => {
        return project?.owner?.id || null;
      },
      comparator: (value: string, other: string, sign = 1): number => {
        if (value === 'Other') {
          if (other === 'Other') {
            return 0;
          } else {
            return sign;
          }
        } else {
          if (other === 'Other') {
            return -sign;
          } else {
            return RowService.comparator(value, other, sign);
          }
        }
      },
      filterType: ColumnFilterType.stringAutoComplete,
      filterComparator: (value: string, other: string, sign = 1): number => {
        if (value === 'Other') {
          if (other === 'Other') {
            return 0;
          } else {
            return sign;
          }
        } else {
          if (other === 'Other') {
            return -sign;
          } else {
            return RowService.comparator(value, other, sign);
          }
        }
      },
    },
    {
      id: 'creators',
      key: ['metadata', 'creators'],
      heading: 'Creators',
      leftIcon: 'author',
      filterable: true,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string[] => {
        return project.metadata.creators.map((v: LabeledIdentifier) => v.label || v.uri) as string[];
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return project.metadata.creators
          .map((v: LabeledIdentifier) => {
            if (!v.label && v.uri) {
              return this.processUriForSearch(v.uri);
            } else {
              return '';
            }
          })
          .join(' ');
      },
      filterType: ColumnFilterType.stringAutoComplete,
    },
    {
      id: 'contributors',
      key: ['metadata', 'contributors'],
      heading: 'Contributors',
      leftIcon: 'curator',
      filterable: true,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string[] => {
        return project.metadata.contributors.map((v: LabeledIdentifier) => v.label || v.uri) as string[];
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return project.metadata.contributors
          .map((v: LabeledIdentifier) => {
            if (!v.label && v.uri) {
              return this.processUriForSearch(v.uri);
            } else {
              return '';
            }
          })
          .join(' ');
      },
      filterType: ColumnFilterType.stringAutoComplete,
    },
    {
      id: 'funders',
      key: ['metadata', 'funders'],
      heading: 'Funders',
      leftIcon: 'funding',
      filterable: true,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string[] => {
        return project.metadata.funders.map((v: LabeledIdentifier) => v.label || v.uri) as string[];
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return project.metadata.funders
          .map((v: LabeledIdentifier) => {
            if (!v.label && v.uri) {
              return this.processUriForSearch(v.uri);
            } else {
              return '';
            }
          })
          .join(' ');
      },
    },
    {
      id: 'license',
      key: ['metadata', 'license'],
      heading: 'License',
      leftIcon: 'license',
      filterable: true,
      hidden: false,
      show: false,
      getter: (project: FormattedProjectSummary): string[] => {
        return (project.metadata.license || []).map((v: LabeledIdentifier) => v.label || v.uri) as string[];
      },
      extraSearchGetter: (project: FormattedProjectSummary): string => {
        return (project.metadata.license || [])
          .map((v: LabeledIdentifier) => {
            if (!v.label && v.uri) {
              return this.processUriForSearch(v.uri);
            } else {
              return '';
            }
          })
          .join(' ');
      },
    },
    {
      id: 'created',
      key: ['metadata', 'created'],
      heading: 'Created',
      leftIcon: 'date',
      hidden: false,
      show: false,
      filterable: true,
      formatter: (value: Date): string => {
        return FormatService.formatDate(value);
      },
      filterType: ColumnFilterType.date,
    },
    {
      id: 'published',
      key: 'created',
      heading: 'Published',
      leftIcon: 'date',
      hidden: false,
      show: false,
      filterable: true,
      formatter: (value: Date): string => {
        return FormatService.formatDate(value);
      },
      filterType: ColumnFilterType.date,
    },
    {
      id: 'updated',
      key: 'updated',
      heading: 'Updated',
      leftIcon: 'date',
      hidden: false,
      show: false,
      filterable: true,
      formatter: (value: Date): string => {
        return FormatService.formatDate(value);
      },
      filterType: ColumnFilterType.date,
    },
  ];

  constructor(private service: BrowseService, private route: ActivatedRoute, private scrollService: ScrollService) {
    this.openControls = this.openControls.bind(this);
  }

  ngOnInit(): void {
    this.projects$ = this.service.getProjects();

    if (this.route.snapshot.fragment) {
      const opts = new URLSearchParams(this.route.snapshot.fragment) as any;
      for (const key of opts.keys()) {
        if (['search', 'sort', 'sortDir', 'columns', 'panel'].includes(key) || key.startsWith('filter.')) {
          this.controlsOpen = true;
          break;
        }
      }
    }
  }

  ngAfterViewInit(): void {
    this.scrollService.init();
  }

  public controlsOpen = false;

  public openControls(route: string, router: Router): void {
    this.controlsOpen = !this.controlsOpen;
    if (this.controlsOpen) {
      this.scrollService.scrollToTop();
    }
  }

  private processUriForSearch(uri: string): string {
    return uri.replace(/[/#:.]/g, ' ');
  }
}
