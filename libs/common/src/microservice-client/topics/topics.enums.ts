import 'dotenv/config';
const region = process.env.REGION ? `.${process.env.REGION}` : '';

export const UploadTopics = {
    UPLOAD_ARTIFACT : `getapp-upload.artifact${region}`,
    UPLOAD_MANIFEST : `getapp-upload.manifest${region}`,
    UPDATE_UPLOAD_STATUS : `getapp-upload.update-upload-status${region}`,
    LAST_VERSION : `getapp-upload.last-version${region}`
} as const

export const DiscoveryTopics = {
    DISCOVERY_MESSAGE : `getapp-discovery.discovery-message${region}`
} as const

export const DeliveryTopics = {
    PREPARE_DELIVERY : `getapp-delivery.prepare${region}`,
    PREPARED_DELIVERY_STATUS : `getapp-delivery.prepared-status${region}`
} as const

export const DeliveryTopicsEmit = {
    UPDATE_DOWNLOAD_STATUS : `getapp-delivery.update-download-status${region}`,
}

export const OfferingTopics = {
    CHECK_UPDATES : `getapp-offering.check-updates${region}`,
    GET_OFFER_OF_COMP : `getapp-offering.get-offering-of-comp${region}`,
} as const

export const DeployTopicsEmit = {
    UPDATE_DEPLOY_STATUS : `getapp-deploy.update-deploy-status${region}`,
} as const

export const ProjectManagementTopics = {
    GET_USER_PROJECTS : `getapp-project-management.get-user-projects${region}`,
    GET_PROJECT_CONFIG_OPTION : `getapp-project-management.get-project-config-option${region}`,
    SET_PROJECT_CONFIG_OPTION : `getapp-project-management.set-project-config-option${region}`,
    CREATE_PROJECT : `getapp-project-management.create-project${region}`,
    CREATE_TOKEN : `getapp-project-management.create-token${region}`,
    ADD_NEW_MEMBER : `getapp-project-management.add-new-member${region}`,
    EDIT_MEMBER : `getapp-project-management.edit-member${region}`,
    REMOVE_MEMBER : `getapp-project-management.remove-member${region}`,
    GET_PROJECT_RELEASES : `getapp-project-management.get-project-releases${region}`,

    GET_DEVICES_BY_CATALOG_ID : `getapp-project-management.get-devices-by-catalog-id${region}`,
    GET_DEVICES_BY_PROJECT : `getapp-project-management.get-devices-by-project${region}`,
    GET_DEVICES_BY_PLATFORM : `getapp-project-management.get-devices-by-platform${region}`,
} as const

export const GetMapTopics = {
    // Discovery
    GET_RECORDS_COUNT : `getapp-map.discovery.get-records-count-of-device${region}`,
    // Import
    GET_IMPORT_STATUS : `getapp-map.get.import.status${region}`,
    POST_IMPORT_STATUS : `getapp-map.post.import.status${region}`,
    CREATE_IMPORT : `getapp-map.import.create${region}`,
    CANCEL_IMPORT_CREATE : `getapp-map.import.create.cancel${region}`,
    // Device
    REGISTER_MAP : `getapp-device.map.register${region}`,
    DISCOVERY_MAP : `getapp-device.discover.map${region}`,

    MPA_PROPERTIES : `getapp-map.map.properties${region}`
} as const

export const DeviceTopics = {
    All_DEVICES : `getapp-device.all${region}`,
    All_MAPS : `getapp-map.maps${region}`,
    GET_MAP : `getapp-map.map.id${region}`,
    REGISTER_SOFTWARE : `getapp-device.register.software${region}`,
    DEVICE_CONTENT : `getapp-device.content.installed${region}`,
    DISCOVERY_SOFTWARE : `getapp-device.discover.software.catalog${region}`,
    IM_PULL_DISCOVERY: `getapp-device.im.pull.discovery${region}`,
} as const

export const DeviceTopicsEmit = {
    UPDATE_TLS_STATUS : `getapp-device.update.tls.status${region}`,
    SAVE_MAP_DATA : `getapp-device.map.save-data${region}`,
    IM_PUSH_DISCOVERY: `getapp-device.im.push.discovery${region}`,
} as const


export const DevicesGroupTopics = {
    CREATE_GROUP : `getapp-device.group.create${region}`,
    EDIT_GROUP : `getapp-device.group.edit${region}`,
    GET_GROUPS : `getapp-device.group.get-all${region}`,
    GET_GROUP_DEVICES : `getapp-device.group.get-devices${region}`,
    SET_GROUP_DEVICES : `getapp-device.group.set-devices${region}`,
} as const