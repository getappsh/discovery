import { ApiRole } from '../../permissions/constants/roles.enum';

/**
 * Role descriptions for better documentation in OIDC provider
 */
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  'permissions-enabled': 'Special stamp role that enables permission validation when present',

  // Project Management
  'create-project': 'Permission to create new projects',
  'view-project': 'Permission to view project details',
  'update-project': 'Permission to update existing projects',
  'delete-project': 'Permission to delete projects',
  'list-projects': 'Permission to list/browse all projects',

  // Release Management
  'create-release': 'Permission to create new releases',
  'view-release': 'Permission to view release details',
  'update-release': 'Permission to update existing releases',
  'delete-release': 'Permission to delete releases',
  'push-release': 'Permission to push/deploy releases',
  'publish-release': 'Permission to publish releases',
  'list-releases': 'Permission to list/browse all releases',

  // Artifact Management
  'upload-artifact': 'Permission to upload artifacts',
  'download-artifact': 'Permission to download artifacts',
  'delete-artifact': 'Permission to delete artifacts',
  'view-artifact': 'Permission to view artifact details',
  'list-artifacts': 'Permission to list/browse artifacts',

  // Deployment
  'deploy-dev': 'Permission to deploy to development environments',
  'deploy-staging': 'Permission to deploy to staging environments',
  'deploy-production': 'Permission to deploy to production environments',

  // Discovery & Offerings
  'view-discovery': 'Permission to view discovery services and devices',
  'manage-discovery': 'Permission to manage discovery services (edit, delete devices)',
  'link-project-device-type': 'Permission to link projects to device types',
  'view-offering': 'Permission to view offerings',
  'create-offering': 'Permission to create offerings',
  'update-offering': 'Permission to update offerings',
  'delete-offering': 'Permission to delete offerings',

  // User Management
  'view-user': 'Permission to view user information',
  'manage-users': 'Permission to manage users',

  // Analytics & Monitoring
  'view-analytics': 'Permission to view analytics and reports',
  'view-logs': 'Permission to view system logs',
  'view-metrics': 'Permission to view system metrics',

  // Configuration
  'manage-config': 'Permission to manage system configuration',
  'view-config': 'Permission to view system configuration',
};

/**
 * Interface for role definition
 */
export interface RoleDefinition {
  name: string;
  description: string;
  composite?: boolean;
  compositeRoles?: string[];
}

/**
 * Interface for group definition
 */
export interface GroupDefinition {
  name: string;
  description?: string;
  path?: string;
  compositeRoles: string[]; // Composite roles to assign to this group
  attributes?: Record<string, string[]>;
}

/**
 * Composite roles definitions
 */
export const COMPOSITE_ROLES: RoleDefinition[] = [
  {
    name: 'contributor',
    description: 'Composite role for contributors - can view and create releases, projects, and upload artifacts',
    composite: true,
    compositeRoles: [
      // Projects
      ApiRole.CREATE_PROJECT,
      ApiRole.VIEW_PROJECT,
      ApiRole.UPDATE_PROJECT,
      ApiRole.DELETE_PROJECT,
      ApiRole.LIST_PROJECTS,
      // Releases
      ApiRole.VIEW_RELEASE,
      ApiRole.CREATE_RELEASE,
      ApiRole.UPDATE_RELEASE,
      ApiRole.DELETE_RELEASE,
      ApiRole.PUBLISH_RELEASE,
      ApiRole.LIST_RELEASES,
      // Artifacts
      ApiRole.UPLOAD_ARTIFACT,
      ApiRole.DOWNLOAD_ARTIFACT,
      ApiRole.VIEW_ARTIFACT,
      ApiRole.DELETE_ARTIFACT,
      ApiRole.LIST_ARTIFACTS,
      // View permissions
      ApiRole.VIEW_DISCOVERY,
      ApiRole.VIEW_OFFERING,
      ApiRole.VIEW_USER,
      ApiRole.VIEW_ANALYTICS,
      ApiRole.VIEW_LOGS,
      ApiRole.VIEW_METRICS,
      ApiRole.VIEW_CONFIG,
      // Enable permissions
      ApiRole.PERMISSIONS_ENABLED,
    ],
  },
  {
    name: 'system-administrator',
    description: 'Composite role for system administrators - can deploy to devices, link projects to device types, manage devices, view analytics and logs',
    composite: true,
    compositeRoles: [
      // Deployment
      ApiRole.DEPLOY_DEV,
      ApiRole.DEPLOY_STAGING,
      ApiRole.DEPLOY_PRODUCTION,
      // Discovery & Device Management
      ApiRole.VIEW_DISCOVERY,
      ApiRole.MANAGE_DISCOVERY,
      ApiRole.LINK_PROJECT_DEVICE_TYPE,
      // Offerings
      ApiRole.VIEW_OFFERING,
      ApiRole.CREATE_OFFERING,
      ApiRole.UPDATE_OFFERING,
      ApiRole.DELETE_OFFERING,
      
      // Pushing a release to devices
      ApiRole.PUSH_RELEASE,

      // User Management
      ApiRole.VIEW_USER,
      ApiRole.MANAGE_USERS,
      // Analytics & Monitoring
      ApiRole.VIEW_ANALYTICS,
      ApiRole.VIEW_LOGS,
      ApiRole.VIEW_METRICS,
      // Configuration
      ApiRole.MANAGE_CONFIG,
      ApiRole.VIEW_CONFIG,
      // View permissions (Projects, Releases, Artifacts)
      ApiRole.VIEW_PROJECT,
      ApiRole.LIST_PROJECTS,
      ApiRole.VIEW_RELEASE,
      ApiRole.LIST_RELEASES,
      ApiRole.VIEW_ARTIFACT,
      ApiRole.LIST_ARTIFACTS,
      // Enable permissions
      ApiRole.PERMISSIONS_ENABLED,
    ],
  },
];

/**
 * Group definitions - groups mapped to composite roles
 */
export const GROUP_DEFINITIONS: GroupDefinition[] = [
  {
    name: 'Contributors',
    path: '/Contributors',
    description: 'Users who can contribute to projects - create releases, upload artifacts, and manage projects',
    compositeRoles: ['contributor'],
    attributes: {
      'group-type': ['contributor'],
      'auto-managed': ['true'],
    },
  },
  {
    name: 'System Administrators',
    path: '/System Administrators',
    description: 'Users who can deploy applications, manage devices, and configure the system',
    compositeRoles: ['system-administrator'],
    attributes: {
      'group-type': ['administrator'],
      'auto-managed': ['true'],
    },
  },
];
