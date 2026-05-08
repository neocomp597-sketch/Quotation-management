const mongoose = require('mongoose');

const RolePermissionSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            required: true,
            unique: true,
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

module.exports = mongoose.model('RolePermission', RolePermissionSchema);
