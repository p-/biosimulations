import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, UntypedFormControl, Validators, ValidationErrors } from '@angular/forms';
import { CombineApiService } from '@biosimulations/simulation-project-utils/service';
import {
  ValidationReport,
  ValidationMessage,
  ValidationStatus,
  OmexMetadataInputFormat,
  OmexMetadataSchema,
} from '@biosimulations/datamodel/common';
import { Subscription, BehaviorSubject } from 'rxjs';
import { ConfigService } from '@biosimulations/config/angular';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Params } from '@angular/router';
import isUrl from 'is-url';
import { HtmlSnackBarComponent } from '@biosimulations/shared/ui';
import { FileInput } from '@biosimulations/material-file-input';

enum SubmitMethod {
  file = 'file',
  url = 'url',
}

interface LabelValue {
  label: string;
  value: string;
}

@Component({
  selector: 'biosimulations-validate-project',
  templateUrl: './validate-project.component.html',
  styleUrls: ['./validate-project.component.scss'],
})
export class ValidateProjectComponent implements OnInit, OnDestroy {
  submitMethod: SubmitMethod = SubmitMethod.file;
  formGroup: UntypedFormGroup;
  submitMethodControl: UntypedFormControl;
  projectFileControl: UntypedFormControl;
  projectUrlControl: UntypedFormControl;

  omexMetadataFormats = Object.keys(OmexMetadataInputFormat).sort();
  omexMetadataSchemas: LabelValue[] = [
    {
      label: 'BioSimulations',
      value: 'BioSimulations',
    },
    {
      label: 'None (OMEX Metadata)',
      value: 'rdf_triples',
    },
  ];

  exampleCombineArchiveUrl: string;
  exampleCombineArchivesUrl: string;

  submitPushed = false;

  private subscriptions: Subscription[] = [];

  status: ValidationStatus | undefined = undefined;
  errors: string | undefined = undefined;
  warnings: string | undefined = undefined;

  constructor(
    private config: ConfigService,
    private formBuilder: UntypedFormBuilder,
    private combineApiService: CombineApiService,
    private activatedRoute: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {
    this.formGroup = this.formBuilder.group(
      {
        submitMethod: [SubmitMethod.file],
        projectFile: ['', [Validators.required, this.maxFileSizeValidator.bind(this)]],
        projectUrl: ['', [this.urlValidator]],
        omexMetadataFormat: [OmexMetadataInputFormat.rdfxml],
        omexMetadataSchema: [OmexMetadataSchema.BioSimulations],
        validateOmexManifest: [true],
        validateSedml: [true],
        validateSedmlModels: [true],
        validateOmexMetadata: [true],
        validateImages: [true],
      },
      //{
      //  validators: this.formValidator,
      //},
    );

    this.submitMethodControl = this.formGroup.controls.submitMethod as UntypedFormControl;
    this.projectFileControl = this.formGroup.controls.projectFile as UntypedFormControl;
    this.projectUrlControl = this.formGroup.controls.projectUrl as UntypedFormControl;

    this.projectUrlControl.disable();

    this.exampleCombineArchivesUrl =
      'https://github.com/' +
      this.config.appConfig.exampleCombineArchives.repoOwnerName +
      '/tree' +
      '/' +
      this.config.appConfig.exampleCombineArchives.repoRef +
      '/' +
      config.appConfig.exampleCombineArchives.repoPath;
    this.exampleCombineArchiveUrl =
      'https://github.com/' +
      this.config.appConfig.exampleCombineArchives.repoOwnerName +
      '/raw' +
      '/' +
      this.config.appConfig.exampleCombineArchives.repoRef +
      '/' +
      this.config.appConfig.exampleCombineArchives.repoPath +
      this.config.appConfig.exampleCombineArchives.exampleProjectPath;
  }

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe((params: Params): void => {
      const archiveUrl = params?.archiveUrl;
      if (archiveUrl) {
        const submitMethodControl = this.formGroup.controls.submitMethod as UntypedFormControl;
        const projectUrlControl = this.formGroup.controls.projectUrl as UntypedFormControl;
        submitMethodControl.setValue(SubmitMethod.url);
        projectUrlControl.setValue(archiveUrl);
        this.changeSubmitMethod();
      }

      const omexMetadataFormat = params?.omexMetadataFormat;
      if (this.omexMetadataFormats.includes(omexMetadataFormat)) {
        (this.formGroup.controls.omexMetadataFormat as UntypedFormControl).setValue(omexMetadataFormat);
      }

      const omexMetadataSchema = params?.omexMetadataSchema;
      if (this.omexMetadataSchemas.map((format: LabelValue): string => format.value).includes(omexMetadataSchema)) {
        (this.formGroup.controls.omexMetadataSchema as UntypedFormControl).setValue(omexMetadataSchema);
      }

      if (['0', 'false'].includes(params?.validateOmexManifest?.toLowerCase())) {
        (this.formGroup.controls.validateOmexManifest as UntypedFormControl).setValue(false);
      }

      if (['0', 'false'].includes(params?.validateSedml?.toLowerCase())) {
        (this.formGroup.controls.validateSedml as UntypedFormControl).setValue(false);
      }

      if (['0', 'false'].includes(params?.validateSedmlModels?.toLowerCase())) {
        (this.formGroup.controls.validateSedmlModels as UntypedFormControl).setValue(false);
      }

      if (['0', 'false'].includes(params?.validateOmexMetadata?.toLowerCase())) {
        (this.formGroup.controls.validateOmexMetadata as UntypedFormControl).setValue(false);
      }

      if (['0', 'false'].includes(params?.validateImages?.toLowerCase())) {
        (this.formGroup.controls.validateImages as UntypedFormControl).setValue(false);
      }

      if (['1', 'true'].includes(params?.autoRun?.toLowerCase())) {
        this.submitForm();
      }
    });
  }

  maxFileSizeValidator(control: UntypedFormControl): ValidationErrors | null {
    const fileInput: FileInput | null = control.value;
    const file: File | undefined = fileInput?.files ? fileInput.files[0] : undefined;
    const fileSize = file?.size;
    if (fileSize && fileSize > this.config.appConfig.maxUploadFileSize) {
      return {
        maxSize: true,
      };
    } else {
      return null;
    }
  }

  urlValidator(control: UntypedFormControl): ValidationErrors | null {
    const value = control.value;
    if (value && isUrl(control.value)) {
      return null;
    } else {
      return {
        url: true,
      };
    }
  }

  formValidator(formGroup: UntypedFormGroup): ValidationErrors | null {
    const errors: ValidationErrors = {};

    if (formGroup.value.submitMethod == SubmitMethod.file) {
      if (!formGroup.value.projectFile) {
        errors['noProjectFile'] = true;
      }
    } else {
      if (!formGroup.value.projectUrl) {
        errors['noProjectUrl'] = true;
      }
    }

    if (Object.keys(errors).length) {
      return errors;
    } else {
      return null;
    }
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  changeSubmitMethod(): void {
    const submitMethodControl = this.formGroup.controls.submitMethod as UntypedFormControl;
    if (submitMethodControl.value === SubmitMethod.file) {
      this.formGroup.controls.projectFile.enable();
      this.formGroup.controls.projectUrl.disable();
    } else {
      this.formGroup.controls.projectFile.disable();
      this.formGroup.controls.projectUrl.enable();
    }
  }

  submitForm(): void {
    this.submitPushed = true;

    if (!this.formGroup.valid) {
      return;
    }

    // clear previous report
    this.status = undefined;
    this.errors = undefined;
    this.warnings = undefined;

    // get data for API
    const submitMethodControl = this.formGroup.controls.submitMethod as UntypedFormControl;

    let archive: File | string = '';
    if (submitMethodControl.value === SubmitMethod.file) {
      const fileInput: FileInput = this.formGroup.controls.projectFile.value;
      archive = fileInput.files[0];
    } else {
      archive = this.formGroup.controls.projectUrl.value;
    }

    // call API to validate archive
    const validationSub = this.combineApiService
      .validateProject(
        archive,
        this.formGroup.controls.omexMetadataFormat.value,
        this.formGroup.controls.omexMetadataSchema.value,
        this.formGroup.controls.validateOmexManifest.value,
        this.formGroup.controls.validateSedml.value,
        this.formGroup.controls.validateSedmlModels.value,
        this.formGroup.controls.validateOmexMetadata.value,
        this.formGroup.controls.validateImages.value,
      )
      .subscribe((report: ValidationReport | undefined): void => {
        if (report) {
          this.status = report.status;

          if (report?.errors?.length) {
            this.errors = this.convertValidationMessagesToList(report?.errors as ValidationMessage[]);
          }
          if (report?.warnings?.length) {
            this.warnings = this.convertValidationMessagesToList(report?.warnings as ValidationMessage[]);
          }

          this.snackBar.open('The validation of your project completed.', 'Ok', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
        } else {
          let msg = 'Sorry! We were unable to validate your archive.';
          if (submitMethodControl.value == SubmitMethod.url) {
            msg += ` Please check that ${archive} is an accessible URL.`;
          }
          msg += ' Please refresh to try again.';

          this.snackBar.open(msg, 'Ok', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
        }
      });
    this.subscriptions.push(validationSub);

    // display status
    this.snackBar.openFromComponent(HtmlSnackBarComponent, {
      data: {
        message: 'Please wait while your project is validated',
        spinner: true,
        action: 'Ok',
      },
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  private convertValidationMessagesToList(messages: ValidationMessage[]): string {
    return messages
      .map((message: ValidationMessage): string => {
        let details = '';
        if (message?.details?.length) {
          details = '<ul>' + this.convertValidationMessagesToList(message?.details as ValidationMessage[]) + '</ul>';
        }

        return '<li>' + message.summary + details + '</li>';
      })
      .join('\n');
  }

  private formSectionOpen = {
    metadataOptions: new BehaviorSubject<boolean>(true),
    validationOptions: new BehaviorSubject<boolean>(true),
  };
  formSectionOpen$ = {
    metadataOptions: this.formSectionOpen.metadataOptions.asObservable(),
    validationOptions: this.formSectionOpen.validationOptions.asObservable(),
  };
  toggleFormSection(name: 'metadataOptions' | 'validationOptions'): void {
    this.formSectionOpen[name].next(!this.formSectionOpen[name].value);
  }
}
