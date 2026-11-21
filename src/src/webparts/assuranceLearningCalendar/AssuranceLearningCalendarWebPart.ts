import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  IPropertyPaneDropdownOption,
  PropertyPaneDropdown,
  PropertyPaneSlider,
  PropertyPaneTextField,
  PropertyPaneToggle
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { SPComponentLoader } from '@microsoft/sp-loader';

import * as strings from 'AssuranceLearningCalendarWebPartStrings';
import AssuranceLearningCalendar, { DEFAULT_SIDE_GUTTER } from './components/AssuranceLearningCalendar';
import { IAssuranceLearningCalendarProps } from './components/IAssuranceLearningCalendarProps';
import { ICourseService } from './services/ICourseService';
import { LocalCourseService } from './services/LocalCourseService';
import { DEFAULT_LIST_NAME, SharePointCourseService } from './services/SharePointCourseService';

export type DataSource = 'Local' | 'SharePoint';

export interface IAssuranceLearningCalendarWebPartProps {
  dataSource: DataSource;
  listName: string;
  /** Optional absolute URL of the site holding the list; empty = current site. */
  siteUrl: string;
  title: string;
  questionsLinkText: string;
  questionsLinkUrl: string;
  contactEmail: string;
  heroImageUrl: string;
  tableHeight: number;
  /** Same look on every screen resolution (page scaled to the screen width; browser zoom still zooms). */
  fitToWidth: boolean;
  /** Side bar width on each side at 100% zoom, % of the screen width. */
  sideGutter: number;
  /** Side bar colour (any CSS colour); empty = transparent. */
  gutterColor: string;
}

const FONT_URL: string = 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&display=swap';

export default class AssuranceLearningCalendarWebPart extends BaseClientSideWebPart<IAssuranceLearningCalendarWebPartProps> {
  private _root: Root | undefined;
  private _service: ICourseService | undefined;
  private _serviceKey: string = '';

  protected onInit(): Promise<void> {
    try {
      SPComponentLoader.loadCss(FONT_URL);
    } catch {
      // Falls back to Segoe UI.
    }
    return super.onInit();
  }

  public render(): void {
    const p: IAssuranceLearningCalendarWebPartProps = this.properties;
    const contactEmail: string = p.contactEmail || 'usaalearning2@deloitte.com';

    const element: React.ReactElement<IAssuranceLearningCalendarProps> = React.createElement(
      AssuranceLearningCalendar,
      {
        dataService: this._getService(),
        dataKey: this._serviceKey,
        title: p.title || 'Assurance Virtual Learning Enrollment Calendar',
        questionsLinkText: p.questionsLinkText || 'Audit & Assurance Learning',
        questionsLinkUrl: p.questionsLinkUrl || `mailto:${contactEmail}`,
        contactEmail,
        heroImageUrl: p.heroImageUrl || undefined,
        tableHeight: p.tableHeight || 440,
        // Older instances have no value yet: treat that as on.
        fitToWidth: p.fitToWidth !== false,
        sideGutter: typeof p.sideGutter === 'number' ? p.sideGutter : DEFAULT_SIDE_GUTTER,
        gutterColor: (p.gutterColor || '').trim()
      }
    );

    if (!this._root) {
      this._root = createRoot(this.domElement);
    }
    this._root.render(element);
  }

  protected onDispose(): void {
    if (this._root) {
      this._root.unmount();
      this._root = undefined;
    }
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  private _getService(): ICourseService {
    const p: IAssuranceLearningCalendarWebPartProps = this.properties;
    const webUrl: string = (p.siteUrl || this.context.pageContext.web.absoluteUrl).trim();
    const listName: string = (p.listName || DEFAULT_LIST_NAME).trim();
    const key: string = p.dataSource === 'SharePoint' ? `sp|${webUrl}|${listName}` : 'local';

    if (!this._service || key !== this._serviceKey) {
      this._serviceKey = key;
      this._service =
        p.dataSource === 'SharePoint'
          ? new SharePointCourseService(this._fetchJson, webUrl, listName)
          : new LocalCourseService();
    }
    return this._service;
  }

  private _fetchJson = async (url: string): Promise<unknown> => {
    const response: SPHttpClientResponse = await this.context.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!response.ok) {
      let detail: string = response.statusText;
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        if (body && body.error && body.error.message) {
          detail = body.error.message;
        }
      } catch {
        // ignore body parse errors
      }
      throw new Error(`${response.status} ${detail}`);
    }
    return response.json();
  };

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const sources: IPropertyPaneDropdownOption[] = [
      { key: 'Local', text: strings.DataSourceLocal },
      { key: 'SharePoint', text: strings.DataSourceSharePoint }
    ];
    const isSharePoint: boolean = this.properties.dataSource === 'SharePoint';

    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.DataGroupName,
              groupFields: [
                PropertyPaneDropdown('dataSource', { label: strings.DataSourceFieldLabel, options: sources }),
                PropertyPaneTextField('listName', {
                  label: strings.ListNameFieldLabel,
                  placeholder: DEFAULT_LIST_NAME,
                  disabled: !isSharePoint
                }),
                PropertyPaneTextField('siteUrl', {
                  label: strings.SiteUrlFieldLabel,
                  placeholder: strings.SiteUrlPlaceholder,
                  disabled: !isSharePoint
                })
              ]
            },
            {
              groupName: strings.DisplayGroupName,
              groupFields: [
                PropertyPaneTextField('title', { label: strings.TitleFieldLabel }),
                PropertyPaneTextField('questionsLinkText', { label: strings.QuestionsLinkTextFieldLabel }),
                PropertyPaneTextField('questionsLinkUrl', {
                  label: strings.QuestionsLinkUrlFieldLabel,
                  placeholder: 'mailto:… or https://…'
                }),
                PropertyPaneTextField('contactEmail', { label: strings.ContactEmailFieldLabel }),
                PropertyPaneTextField('heroImageUrl', {
                  label: strings.HeroImageUrlFieldLabel,
                  placeholder: strings.HeroImageUrlPlaceholder
                }),
                PropertyPaneSlider('tableHeight', {
                  label: strings.TableHeightFieldLabel,
                  min: 240,
                  max: 1200,
                  step: 20,
                  showValue: true
                })
              ]
            },
            {
              groupName: strings.LayoutGroupName,
              groupFields: [
                PropertyPaneToggle('fitToWidth', {
                  label: strings.FitToWidthFieldLabel,
                  onText: strings.FitToWidthOn,
                  offText: strings.FitToWidthOff,
                  checked: this.properties.fitToWidth !== false
                }),
                PropertyPaneSlider('sideGutter', {
                  label: strings.SideGutterFieldLabel,
                  min: 0,
                  max: 20,
                  step: 1,
                  showValue: true,
                  value:
                    typeof this.properties.sideGutter === 'number' ? this.properties.sideGutter : DEFAULT_SIDE_GUTTER,
                  disabled: this.properties.fitToWidth === false
                }),
                PropertyPaneTextField('gutterColor', {
                  label: strings.GutterColorFieldLabel,
                  placeholder: strings.GutterColorPlaceholder,
                  disabled: this.properties.fitToWidth === false
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
