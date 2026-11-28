/**
 * The lists of Own Assets, as they appear in the URL (/api/own-assets/<view>/...) and the
 * Authorization screen each one is (config/authorization.js, config/apiPermissions.js).
 */
const OWN_ASSET_VIEWS = {
    mine: { key: 'mine', permissionKey: 'own_assets_mine', label: 'My Assets' },
    manager: { key: 'manager', permissionKey: 'own_assets_manager', label: 'Manager Assets' },
    team: { key: 'team', permissionKey: 'own_assets_team', label: 'My Team Assets' }
};

const OWN_ASSET_PERMISSION_KEYS = Object.values(OWN_ASSET_VIEWS).map((view) => view.permissionKey);

module.exports = { OWN_ASSET_VIEWS, OWN_ASSET_PERMISSION_KEYS };
