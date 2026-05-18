const mongoose = require('mongoose');

const RolePermissionSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            required: true,
            trim: true
        },
        label: {
            type: String,
            default: ''
        },
        description: {
            type: String,
            default: ''
        },
        isCustom: {
            type: Boolean,
            default: false
        },
        menuVisibility: {
            type: Map,
            of: Boolean,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

const tenantPlugin = require('./plugins/tenantPlugin');
RolePermissionSchema.plugin(tenantPlugin);
RolePermissionSchema.index({ companyId: 1, role: 1 }, { unique: true });
module.exports = mongoose.model('RolePermission', RolePermissionSchema);
