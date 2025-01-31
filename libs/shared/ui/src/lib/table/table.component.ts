import { Component, OnInit, AfterViewInit, Input, Injectable, TemplateRef } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortable, MatSortHeader, Sort, SortDirection } from '@angular/material/sort';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Column,
  ColumnActionType,
  ColumnFilterType,
  IdColumnMap,
  Side,
  RowService,
  ColumnSort,
  ColumnSortDirection,
  TableDataComponent,
} from './table.interface';
import { UtilsService } from '@biosimulations/shared/angular';
import lunr from 'lunr';
import { ActivatedRoute, Router } from '@angular/router';
import { debounce } from 'throttle-debounce';

// TODO improve datasource / loading functionality
@Injectable()
export class TableDataSource extends MatTableDataSource<any> {
  isLoading = new BehaviorSubject(true);

  constructor() {
    super();

    this.data = [];
    this.isLoading.next(true);
  }

  isLoading$(): Observable<boolean> {
    return this.isLoading.asObservable();
  }

  refresh(): void {}
}

interface TableState {
  filter?: { [id: string]: any[] };
  searchQuery?: string;
  showColumns: { [id: string]: boolean };
  openControlPanelId?: number;
  sort?: Sort;
}

function normalizeAccentsLunrPipelineFunction(token: any): any {
  if (token.toString()) {
    return token.update(function () {
      return token
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    });
  } else {
    return token;
  }
}

lunr.Pipeline.registerFunction(normalizeAccentsLunrPipelineFunction, 'normalizeAccents');

function addAccentNormalizationToLunrBuilder(builder: any): void {
  // Add the pipeline function to both the indexing pipeline and the
  // searching pipeline
  builder.pipeline.before(lunr.stemmer, normalizeAccentsLunrPipelineFunction);
  builder.searchPipeline.before(lunr.stemmer, normalizeAccentsLunrPipelineFunction);
}

@Component({
  selector: 'biosimulations-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  providers: [TableDataSource],
})
export class TableComponent implements OnInit, AfterViewInit {
  @Input()
  dataContainer?: TableDataComponent;

  private materialTable!: MatTable<any> | null;
  private materialPaginator!: MatPaginator | null;
  private materialSort!: MatSort | null;

  private _columns?: Column[];
  showColumns!: { [id: string]: boolean };
  columnsToShow!: string[];
  private idToColumn!: IdColumnMap;
  columnFilterData!: { [id: string]: any };
  private dataSet = false;
  private dataLoaded = false;
  private dataSorted = false;
  isLoading!: Observable<boolean>;
  private isLoaded!: Observable<boolean>;
  public filter: { [id: string]: any[] } = {};
  columnIsFiltered: { [id: string]: boolean } = {};
  private tableStateQueryFragment = '';

  private fullTextIndex!: any;
  private fullTextMatches!: { [index: number]: boolean };

  @Input()
  defaultSort!: ColumnSort;

  @Input()
  set columns(columns: Column[] | undefined) {
    this._columns = columns;
    this.columnFilterData = {};
    this.showColumns = {};
    columns?.forEach((column: Column): void => {
      this.showColumns[column.id] = column.show !== false;
    });
    this.setColumnsToShow();

    columns?.forEach((column: Column, iColumn: number): void => {
      column._index = iColumn;
    });

    this.idToColumn = (columns || []).reduce((map: { [id: string]: Column }, col: Column) => {
      map[col.id] = col;
      return map;
    }, {});

    if (this.dataSource.data) {
      this.setData(this.dataSource.data);
    }
  }

  get columns(): Column[] | undefined {
    return this._columns;
  }

  private _highlightRow?: (element: any) => boolean;

  @Input()
  set highlightRow(func: (element: any) => boolean) {
    this._highlightRow = func;
    this.setRowHighlighting(this.dataSource.data);
  }

  @Input()
  sortable = true;

  @Input()
  controls = true;

  private subscription?: Subscription;

  @Input()
  dataControlsTemplate!: TemplateRef<any>;

  @Input()
  set data(data: any) {
    if (data instanceof Observable) {
      this.subscription = data.subscribe((unresolvedData: any[]): void => {
        UtilsService.recursiveForkJoin(unresolvedData).subscribe((resolvedData: any[] | undefined) => {
          if (resolvedData !== undefined) {
            this.dataSet = true;
            this.setData(resolvedData);
          }
        });
      });
    } else if (data) {
      UtilsService.recursiveForkJoin(data).subscribe((resolvedData: any[] | undefined) => {
        if (resolvedData !== undefined) {
          this.dataSet = true;
          this.setData(resolvedData);
        }
      });
    } else {
      this.setData([]);
    }
  }

  private setData(data: any[]): void {
    if (!this.columns) {
      this.dataSource.data = data;
      return;
    }

    this.dataLoaded = false;
    this.dataSorted = false;

    this.dataSource.isLoading.next(true);
    const sortedData = RowService.sortData(this.idToColumn, data, this.defaultSort);
    sortedData.forEach((datum: any, iDatum: number): void => {
      datum._index = iDatum;
    });

    this.setRowHighlighting(sortedData);

    sortedData.forEach((datum: any): void => {
      const cache: any = {};
      datum['_cache'] = cache;

      this?.columns?.forEach((column: Column): void => {
        const value = RowService.getElementValue(datum, column);
        cache[column.id] = {
          value: RowService.formatElementValue(datum, value, column),
          toolTip: RowService.formatElementToolTip(datum, value, column),
          left: {},
          center: {},
          right: {},
        };

        if (column.leftAction === ColumnActionType.routerLink) {
          const tmp = RowService.getElementRouterLink(datum, column, Side.left);
          cache[column.id].left['routerLink'] = tmp.routerLink;
          cache[column.id].left['fragment'] = tmp.fragment;
        } else if (column.leftAction === ColumnActionType.href) {
          cache[column.id].left['href'] = RowService.getElementHref(datum, column, Side.left);
        } else if (column.leftAction === ColumnActionType.click) {
          cache[column.id].left['click'] = RowService.getElementClick(datum, column, Side.left);
        }
        cache[column.id].left['icon'] = RowService.getIcon(datum, column, Side.left);
        cache[column.id].left['iconTitle'] = RowService.getIconTitle(datum, column, Side.left);

        if (column.centerAction === ColumnActionType.routerLink) {
          const tmp = RowService.getElementRouterLink(datum, column, Side.center);
          cache[column.id].center['routerLink'] = tmp.routerLink;
          cache[column.id].center['fragment'] = tmp.fragment;
        } else if (column.centerAction === ColumnActionType.href) {
          cache[column.id].center['href'] = RowService.getElementHref(datum, column, Side.center);
        } else if (column.centerAction === ColumnActionType.click) {
          cache[column.id].center['click'] = RowService.getElementClick(datum, column, Side.center);
        }
        // cache[column.id].center['icon'] = RowService.getIcon(datum, column, Side.center);
        // cache[column.id].center['iconTitle'] = RowService.getIconTitle(datum, column, Side.center);

        if (column.rightAction === ColumnActionType.routerLink) {
          const tmp = RowService.getElementRouterLink(datum, column, Side.right);
          cache[column.id].right['routerLink'] = tmp.routerLink;
          cache[column.id].right['fragment'] = tmp.fragment;
        } else if (column.rightAction === ColumnActionType.href) {
          cache[column.id].right['href'] = RowService.getElementHref(datum, column, Side.right);
        } else if (column.rightAction === ColumnActionType.click) {
          cache[column.id].right['click'] = RowService.getElementClick(datum, column, Side.right);
        }
        cache[column.id].right['icon'] = RowService.getIcon(datum, column, Side.right);
        cache[column.id].right['iconTitle'] = RowService.getIconTitle(datum, column, Side.right);
      });
    });

    this.columns.forEach((column: Column): void => {
      switch (column.filterType) {
        case ColumnFilterType.number:
          this.columnFilterData[column.id] = this.getNumericColumnRange(sortedData, column);
          break;
        case ColumnFilterType.date:
          this.columnFilterData[column.id] = this.filter?.[column.id] || [null, null];
          break;
        default:
          this.columnFilterData[column.id] = this.getTextColumnValues(sortedData, column);
          break;
      }
    });

    // set up full text index
    const columns = this.columns;

    this.fullTextIndex = lunr(function (this: any) {
      this.use(addAccentNormalizationToLunrBuilder);

      this.ref('index');
      columns.forEach((column: Column): void => {
        this.field(column.heading.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-'));
      });

      sortedData.forEach((datum: any, iDatum: number): void => {
        const fullTextDoc: { index: string; [colId: string]: string } = {
          index: iDatum.toString(),
        };
        columns.forEach((column: Column): void => {
          fullTextDoc[column.heading.toLowerCase().replace(' ', '-')] = RowService.getElementSearchValue(datum, column);
        });
        this.add(fullTextDoc);
      });
    });

    // set data for table
    this.dataSource.data = sortedData;
    this.dataSource.isLoading.next(!this.dataSet);
    this.dataLoaded = sortedData.length > 0;

    // set filtering
    this.setDataSourceFilter();
  }

  constructor(public dataSource: TableDataSource, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.isLoading = this.dataSource.isLoading$();
    this.isLoaded = this.dataSource.isLoading$().pipe(map((isloaded: boolean) => !isloaded));
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.evalAutocompleteFilter?.cancel();
  }

  ngAfterViewInit(): void {
    this.materialTable = this?.dataContainer?.materialTable || null;
    this.materialPaginator = this?.dataContainer?.materialPaginator || null;
    this.materialSort = this?.dataContainer?.materialSort || null;

    this.filter = {};
    this.columnIsFiltered = {};
    this.setDataSourceFilter();
    this.dataSource.filterPredicate = this.filterData.bind(this);
    this.dataSource.sort = this.materialSort;
    this.dataSource.sortData = (data: any[], sort: Sort) => {
      const columnSort: ColumnSort = {
        active: sort.active,
        direction: sort.direction ? ColumnSortDirection[sort.direction] : undefined,
      };

      const sortedData = RowService.sortData(this.idToColumn, data, columnSort);

      if (this.dataLoaded) {
        this.setTableStateQueryFragment();
        this.dataSorted = true;
      }

      return sortedData;
    };
    this.dataSource.paginator = this.materialPaginator;
    if (this.materialTable) {
      this.materialTable.dataSource = this.dataSource;
    }

    this.route.fragment.subscribe((fragment: string | null): void => {
      fragment = fragment || '';
      if (fragment != this.tableStateQueryFragment) {
        this.tableStateQueryFragment = fragment;
        const state = this.parseTableStateQueryFragment(fragment);
        this.setTableState(state);
      }
    });

    this.evalAutocompleteFilter = debounce(50, false, (column: Column, filter: string) => {
      this._evalAutocompleteFilter(column, filter);
    });
  }

  setTableStateQueryFragment(): void {
    if (!this.dataLoaded || (this.materialSort && !this.dataSorted)) {
      return;
    }

    let opts = new URLSearchParams();
    if (this.route.snapshot.fragment) {
      opts = new URLSearchParams(this.route.snapshot.fragment);
    }

    if (this.controls) {
      if (opts.has('search')) {
        opts.delete('search');
      }
      if (this.searchQuery) {
        opts.set('search', this.searchQuery);
      }

      this?.columns?.forEach((column: Column): void => {
        if (opts.has('filter.' + column.id)) {
          opts.delete('filter.' + column.id);
        }
        if (column.id in this.filter) {
          opts.set('filter.' + column.id, JSON.stringify(this.filter[column.id]));
        }
      });

      if (opts.has('columns')) {
        opts.delete('columns');
      }
      this?.columns?.forEach((column: Column): void => {
        if (this.showColumns[column.id]) {
          opts.append('columns', column.id);
        }
      });

      opts.set('panel', this.openControlPanelId.toString());
    }

    if (this.sortable && this.materialSort) {
      if (this.materialSort?.active && this.materialSort?.direction) {
        opts.set('sort', this.materialSort.active);
        opts.set('sortDir', this.materialSort.direction);
      } else {
        if (opts.has('sort')) {
          opts.delete('sort');
        }
        if (opts.has('sortDir')) {
          opts.delete('sortDir');
        }
      }
    }

    const fragmentParts: string[] = [];
    opts.forEach((value: string, key: string): void => {
      fragmentParts.push(key + '=' + value);
    });
    fragmentParts.sort();
    const fragment = fragmentParts.join('&') || '';

    if (fragment != this.tableStateQueryFragment) {
      this.tableStateQueryFragment = fragment;
      this.router.navigate([], {
        fragment: fragment,
      });
    }
  }

  parseTableStateQueryFragment(value: string): TableState {
    const opts = new URLSearchParams(value);

    const searchQuery = opts.get('search') || undefined;

    const filter: { [id: string]: any[] } = {};
    opts.forEach((val: string, key: string): void => {
      if (
        key !== 'search' &&
        key !== 'columns' &&
        key != 'panel' &&
        key.startsWith('filter.') &&
        key.replace('filter.', '') in this.showColumns
      ) {
        try {
          filter[key.replace('filter.', '')] = JSON.parse(val);
        } catch (e) {} // eslint-disable-line no-empty
      }
    });

    let showColumns!: { [id: string]: boolean };
    if (opts.has('columns')) {
      const definedShowColumns: { [id: string]: boolean } = {};
      this?.columns?.forEach((column: Column): void => {
        definedShowColumns[column.id] = false;
      });
      opts.getAll('columns').forEach((columnId: string): void => {
        if (columnId in definedShowColumns) {
          definedShowColumns[columnId] = true;
        }
      });
      showColumns = definedShowColumns;
    } else {
      showColumns = {};
      this?.columns?.forEach((column: Column): void => {
        showColumns[column.id] = column.show !== false;
      });
    }

    let openControlPanelId: undefined | number;
    if (opts.get('panel') != null) {
      try {
        openControlPanelId = parseInt(opts.get('panel') as string);
      } catch (e) {} // eslint-disable-line no-empty
    }

    let sort: Sort | undefined;
    const sortActive = opts.get('sort') || undefined;
    if (sortActive) {
      const sortDirection = (opts.get('sortDir') || 'asc') as SortDirection;
      sort = {
        active: sortActive,
        direction: sortDirection,
      };
    }

    return {
      searchQuery,
      filter,
      showColumns,
      openControlPanelId,
      sort,
    };
  }

  setTableState(state: TableState): void {
    const searchQuery = state?.searchQuery;
    const filter = state?.filter || {};
    const showColumns = state?.showColumns;
    const openControlPanelId = state?.openControlPanelId;
    const sort = state?.sort;

    if (this.controls) {
      if (this.searchQuery != searchQuery) {
        this.searchQuery = searchQuery;
      }

      this.filter = filter;
      const columnIsFiltered: { [id: string]: boolean } = {};
      this?.columns?.forEach((column: Column): void => {
        columnIsFiltered[column.id] = column.id in filter;
        switch (column.filterType) {
          case ColumnFilterType.number: {
            if (columnIsFiltered[column.id]) {
              if (!(column.id in this.columnFilterData)) {
                this.columnFilterData[column.id] = {
                  min: null,
                  max: null,
                  step: null,
                  minSelected: null,
                  maxSelected: null,
                };
              }

              if (filter[column.id][0] !== this.columnFilterData[column.id]?.minSelected) {
                this.columnFilterData[column.id].minSelected = filter[column.id][0];
              }
              if (filter[column.id][1] !== this.columnFilterData[column.id]?.maxSelected) {
                this.columnFilterData[column.id].maxSelected = filter[column.id][1];
              }
            }
            break;
          }
          case ColumnFilterType.date: {
            if (columnIsFiltered[column.id]) {
              if (filter[column.id][0] != null) {
                const date = new Date(filter[column.id][0]);
                if (date !== filter[column.id][0]) {
                  filter[column.id][0] = date;
                }
              }
              if (filter[column.id][1] != null) {
                const date = new Date(filter[column.id][1]);
                if (date !== filter[column.id][1]) {
                  filter[column.id][1] = date;
                }
              }
              this.columnFilterData[column.id] = filter[column.id];
            }
            break;
          }
          default: {
            this.columnFilterData[column.id]?.forEach((val: any): void => {
              const checked = filter?.[column.id]?.includes(val.value) || false;
              if (checked !== val.checked) {
                val.checked = checked;
              }
            });
            break;
          }
        }
      });
      this.columnIsFiltered = columnIsFiltered;

      this.setDataSourceFilter();

      this.showColumns = showColumns;
      this.setColumnsToShow();

      if (openControlPanelId !== undefined) {
        setTimeout(() => {
          this.openControlPanelId = openControlPanelId;
        });
      }
    }

    if (this.sortable && this.materialSort) {
      if (sort) {
        if (sort.active != this.materialSort.active || sort.direction != this.materialSort.direction) {
          const matSortable1 = {
            id: '',
            start: sort.direction,
            disableClear: false,
          } as MatSortable;
          this.materialSort.sort(matSortable1);

          const matSortable2 = {
            id: sort.active,
            start: sort.direction as SortDirection,
            disableClear: false,
          } as MatSortable;
          this.materialSort.sort(matSortable2);

          (this.materialSort.sortables.get(sort.active) as MatSortHeader)._setAnimationTransitionState({
            fromState: sort.direction,
            toState: 'active',
          });
        }
      } else if (this.materialSort.active) {
        const matSortable3 = {
          id: '',
          start: 'asc',
          disableClear: false,
        } as MatSortable;
        this.materialSort.sort(matSortable3);
      }
    }
  }

  setRowHighlighting(rows: any[]) {
    rows.forEach((row: any): void => {
      if (this._highlightRow === undefined) {
        row['_highlight'] = false;
      } else {
        row['_highlight'] = this._highlightRow(row);
      }
    });
  }

  getTextColumnValues(data: any[], column: Column): any[] {
    const values: any[] = column.filterValues
      ? column.filterValues
      : data.map((datum: any): any => RowService.getElementFilterValue(datum, column));

    const formattedValuesMap: any = {};
    const allValues = new Set<any>();
    for (const value of values) {
      if (Array.isArray(value)) {
        for (const v of value) {
          const formattedV = RowService.formatElementFilterValue(value, v, column);
          if (formattedV != null && formattedV !== '') {
            formattedValuesMap[v] = formattedV;
            allValues.add(v);
          }
        }
      } else {
        const formattedValue = RowService.formatElementFilterValue(value, value, column);
        if (formattedValue != null && formattedValue !== '') {
          formattedValuesMap[value] = formattedValue;
          allValues.add(value);
        }
      }
    }

    const comparator = RowService.getFilterComparator(column);
    const formattedValuesArr: { value: any; formattedValue: any; checked: boolean }[] = [];
    for (const value of allValues) {
      const formattedValue = {
        value: value,
        formattedValue: formattedValuesMap[value],
        checked: this.filter?.[column.id]?.includes(value) || false,
      };
      formattedValuesArr.push(formattedValue);
    }
    formattedValuesArr.sort((a: any, b: any): number => {
      return comparator(a.value, b.value);
    });

    if (column.filterSortDirection === ColumnSortDirection.desc) {
      formattedValuesArr.reverse();
    }

    return formattedValuesArr;
  }

  getNumericColumnRange(data: any[], column: Column): any {
    if (data.length === 0) {
      return {
        min: null,
        max: null,
        step: null,
        minSelected: null,
        maxSelected: null,
      };
    }

    const range: any = {
      min: null,
      max: null,
      step: null,
      minSelected: null,
      maxSelected: null,
    };

    for (const datum of data) {
      const value = RowService.getElementFilterValue(datum, column);
      if (value == null || value === undefined || isNaN(value)) {
        continue;
      }

      if (range.min == null) {
        range.min = value;
        range.max = value;
      } else {
        if (value < range.min) {
          range.min = value;
        }
        if (value > range.max) {
          range.max = value;
        }
      }
    }

    if (range.min != null) {
      range.min = Math.floor(range.min);
      range.max = Math.ceil(range.max);
    }

    if (column.numericFilterStep !== undefined) {
      range.step = column.numericFilterStep;
    } else if (range.max === range.min) {
      range.step = 0;
    } else {
      range.step = Math.pow(10, Math.floor(Math.log10((range.max - range.min) / 1000)));
    }
    range.step = Math.max(1, range.step);

    if (column.id in this.filter) {
      range.minSelected = this.filter[column.id][0];
      range.maxSelected = this.filter[column.id][1];
    } else {
      range.minSelected = range.min;
      range.maxSelected = range.max;
    }

    return range;
  }

  public evalAutocompleteFilter!: debounce<(column: Column, filter: string) => void>;

  private _evalAutocompleteFilter(column: Column, filter: string): void {
    filter = filter
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    this.columnFilterData[column.id].forEach((value: any): void => {
      value.filtered =
        !filter ||
        value.value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes(filter) ||
        value.formattedValue
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes(filter);
    });
  }

  filterSetValue(column: Column, value: any, show: boolean): void {
    if (show) {
      if (!(column.id in this.filter)) {
        this.filter[column.id] = [];
      }
      this.filter[column.id].push(value.value);
    } else {
      this.filter[column.id].splice(this.filter[column.id].indexOf(value.value), 1);
      if (this.filter[column.id].length === 0) {
        delete this.filter[column.id];
      }
    }
    value.checked = show;
    this.columnIsFiltered[column.id] = column.id in this.filter;

    this.setTableStateQueryFragment();

    this.setDataSourceFilter();
  }

  filterNumberValue(column: Column, fullRange: any, selectedRange: number[]): void {
    if (fullRange.min === selectedRange[0] && fullRange.max === selectedRange[1]) {
      if (column.id in this.filter) {
        delete this.filter[column.id];
      }
    } else {
      this.filter[column.id] = selectedRange;
    }
    this.columnIsFiltered[column.id] = column.id in this.filter;

    this.columnFilterData[column.id].minSelected = selectedRange[0];
    this.columnFilterData[column.id].maxSelected = selectedRange[1];
    this.setTableStateQueryFragment();
    this.setDataSourceFilter();
  }

  filterStartDateValue(column: Column, event: MatDatepickerInputEvent<Date>): void {
    let min: any = null;
    let max: any = null;
    if (event.value == null) {
      if (column.id in this.filter) {
        if (this.filter[column.id][1] == null) {
          delete this.filter[column.id];
        } else {
          this.filter[column.id][0] = null;
          max = this.filter[column.id][1];
        }
      }
    } else {
      if (column.id in this.filter) {
        this.filter[column.id][0] = event.value;
      } else {
        this.filter[column.id] = [event.value, null];
      }
      min = this.filter[column.id][0];
      max = this.filter[column.id][1];
    }
    this.columnIsFiltered[column.id] = column.id in this.filter;
    this.columnFilterData[column.id] = [min, max];
    this.setTableStateQueryFragment();
    this.setDataSourceFilter();
  }

  filterEndDateValue(column: Column, event: MatDatepickerInputEvent<Date>): void {
    let min: any = null;
    let max: any = null;
    if (event.value == null) {
      if (column.id in this.filter) {
        if (this.filter[column.id][0] == null) {
          delete this.filter[column.id];
        } else {
          this.filter[column.id][1] = null;
          min = this.filter[column.id][0];
        }
      }
    } else {
      if (column.id in this.filter) {
        this.filter[column.id][1] = event.value;
      } else {
        this.filter[column.id] = [null, event.value];
      }
      min = this.filter[column.id][0];
      max = this.filter[column.id][1];
    }
    this.columnIsFiltered[column.id] = column.id in this.filter;
    this.columnFilterData[column.id] = [min, max];
    this.setTableStateQueryFragment();
    this.setDataSourceFilter();
  }

  setDataSourceFilter(): void {
    // conduct full text search
    this.fullTextMatches = {};
    if (this.searchQuery && this.fullTextIndex) {
      try {
        this.fullTextIndex.search(this.searchQuery).forEach((match: any): void => {
          this.fullTextMatches[parseInt(match.ref)] = true;
        });
      } finally {
        // eslint-disable-next-line no-empty
      }
    }

    // trigger table to filter data via calling the filterData method for each entry
    if (Object.keys(this.filter).length || this.searchQuery) {
      // Hack: alternate between value of 'a' and 'b' to force data source to filter the data
      if (this.dataSource.filter === 'a') {
        this.dataSource.filter = 'b';
      } else {
        this.dataSource.filter = 'a';
      }
    } else {
      this.dataSource.filter = '';
    }
  }

  filterData(datum: any, filter: string): boolean {
    /* filtering */
    for (const columnId in this.filter) {
      const column = this.idToColumn[columnId];

      let passesFilter;
      if (column.passesFilter === undefined) {
        passesFilter = this.passesColumnFilter.bind(this, column);
      } else {
        passesFilter = column.passesFilter;
      }

      const filterValue = this.filter[column.id];

      if (!passesFilter(datum, filterValue)) {
        return false;
      }
    }

    // full text search
    if (this.searchQuery) {
      if (!(datum._index in this.fullTextMatches)) {
        return false;
      }
    }

    /* return */
    return true;
  }

  passesColumnFilter(column: Column, datum: any, filterValue: any[]): boolean {
    const value = RowService.getElementFilterValue(datum, column);

    if (column.filterType === ColumnFilterType.number) {
      if (
        value == null ||
        value === undefined ||
        isNaN(value) ||
        (filterValue[0] != null && value < filterValue[0]) ||
        (filterValue[1] != null && value > filterValue[1])
      ) {
        return false;
      }
    } else if (column.filterType === ColumnFilterType.date) {
      const startDate = filterValue[0];
      let endDate = filterValue[1];
      if (endDate != null) {
        endDate = new Date(endDate);
        endDate.setDate(endDate.getDate() + 1);
      }

      if (
        value == null ||
        value === undefined ||
        (startDate != null && value < startDate) ||
        (endDate != null && value >= endDate)
      ) {
        return false;
      }
    } else {
      if (Array.isArray(value)) {
        let match = false;
        for (const v of value) {
          if (filterValue.includes(v)) {
            match = true;
            break;
          }
        }
        if (!match) {
          return false;
        }
      } else {
        if (!filterValue.includes(value)) {
          return false;
        }
      }
    }

    return true;
  }

  clearFilter(column: Column): void {
    delete this.filter[column.id];
    if (Array.isArray(this.columnFilterData[column.id])) {
      if (
        this.columnFilterData[column.id].length > 0 &&
        this.columnFilterData[column.id][0] &&
        typeof this.columnFilterData[column.id][0] === 'object' &&
        'checked' in this.columnFilterData[column.id][0]
      ) {
        for (const val of this.columnFilterData[column.id]) {
          val.checked = false;
        }
      } else {
        this.columnFilterData[column.id] = [null, null];
      }
    } else {
      this.columnFilterData[column.id].minSelected = this.columnFilterData[column.id].min;
      this.columnFilterData[column.id].maxSelected = this.columnFilterData[column.id].max;
    }
    this.columnIsFiltered[column.id] = false;
    this.setTableStateQueryFragment();
    this.setDataSourceFilter();
  }

  toggleColumn(column: Column): void {
    this.showColumns[column.id] = this.showColumns[column.id] === false;
    this.setColumnsToShow();
    this.setTableStateQueryFragment();
  }

  setColumnsToShow(): void {
    const columnsToShow: string[] = [];
    Object.keys(this.showColumns).forEach((colId: string): void => {
      if (this.showColumns[colId]) {
        columnsToShow.push(colId);
      }
    });
    setTimeout(() => {
      this.columnsToShow = columnsToShow;
      this?.columns?.forEach((column: Column): void => {
        column._visible = columnsToShow.includes(column.id);
      });
    });
  }

  refresh(): void {
    this.dataSource.refresh();
  }

  isObservable(value: any): boolean {
    return value instanceof Observable;
  }

  controlsOpen = true;

  toggleControls(): void {
    this.controlsOpen = !this.controlsOpen;
  }

  openControlPanelId = 2;

  openControlPanel(id: number): void {
    if (id != this.openControlPanelId) {
      this.openControlPanelId = id;
      this.setTableStateQueryFragment();
    }
  }

  searchQuery: string | undefined = undefined;

  searchRows(query: string): void {
    this.searchQuery = query.toLowerCase() || undefined;
    this.setTableStateQueryFragment();
    this.setDataSourceFilter();
  }
}
