const mongoose = require('mongoose');
const { ROLE_OPTIONS } = require('../config/authorization');

const RolePermissionSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ROLE_OPTIONS,
            required: true,
            unique: true
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
