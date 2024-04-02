import { MapEntity, MapImportStatusEnum } from "@app/common/database/entities";

export const mapEntityStub = (): MapEntity => {
  return {
    catalogId: "map-catalog-id",
    productId: "map-product-id",
    productName: "map-product-name",
    fileName: "file-name.ptg",
    zoomLevel: 13,
    createDateTime: new Date("2023-07-19T14:24:54.885Z"),
    boundingBox: "35.71927028,32.01644704,35.72253451,32.01871780",
    packageUrl: "url/to/map/package",
    status: MapImportStatusEnum.START,
  } as MapEntity
}