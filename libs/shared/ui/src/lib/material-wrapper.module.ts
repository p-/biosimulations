import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MatStepperModule } from '@angular/material/stepper';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MaterialFileInputModule } from '@biosimulations/material-file-input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

const materialImports = [
  FlexLayoutModule,
  MatInputModule,
  MatCardModule,
  MatButtonModule,
  MatToolbarModule,
  MatStepperModule,
  MatIconModule,
  MatSidenavModule,
  MatListModule,
  MatTabsModule,
  MatProgressSpinnerModule,
  MatTooltipModule,
  MatExpansionModule,
  MatMenuModule,
  MatFormFieldModule,
  MatCheckboxModule,
  MatDatepickerModule,
  MatNativeDateModule,
  MaterialFileInputModule,
  MatTableModule,
  DragDropModule,
  MatTooltipModule,
  MatSortModule,
  MatChipsModule,
  MatAutocompleteModule,
  MatSnackBarModule,
];

@NgModule({
  imports: [CommonModule, ...materialImports],
  exports: [...materialImports],
})
export class MaterialWrapperModule {}
