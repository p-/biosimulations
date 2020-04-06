import { VisualizationLayoutElementDTO } from '../common/visualization-layout-element.dto';
import { ResourceDTO } from './resource.dto';
import { ResourceType } from '../enums/resource-type';

export class VisualizationDTO extends ResourceDTO {
  type = ResourceType.visualization;
  columns: number;
  layout: VisualizationLayoutElementDTO;
}
