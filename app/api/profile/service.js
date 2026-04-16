"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileService = exports.profilesService = void 0;
const state_1 = require("../state");
exports.profilesService = {
    createProfiles(profilesToCreate) {
        return __awaiter(this, void 0, void 0, function* () {
            return profilesToCreate.filter(profile => !(0, state_1.isKnown)(profile))
                .reduce((count, profile) => {
                (0, state_1.setProfile)(profile);
                return ++count;
            }, 0);
        });
    },
    readProfiles() {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, state_1.profiles)();
        });
    },
    updateProfiles(profilesToUpdate) {
        return __awaiter(this, void 0, void 0, function* () {
            return profilesToUpdate.filter(profile => (0, state_1.isKnown)(profile))
                .reduce((count, profileToUpdate) => {
                (0, state_1.setProfile)(profileToUpdate);
                return ++count;
            }, 0);
        });
    },
    deleteProfiles(profileIdsToDelete) {
        return __awaiter(this, void 0, void 0, function* () {
            const before = (0, state_1.profiles)().length;
            const id = profileIdsToDelete.filter(id => (0, state_1.ids)().includes(id));
            (0, state_1.setProfiles)((0, state_1.profiles)().filter(p => !id.includes(p.id)));
            return (0, state_1.profiles)().length - before;
        });
    }
};
exports.profileService = {
    readProfile(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const profile = (0, state_1.getProfile)(id);
            if (!profile)
                throw new Error('Profile not found');
            return profile;
        });
    },
    createProfile(profile) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((0, state_1.isKnown)(profile))
                throw new Error('Profile already exists');
            (0, state_1.setProfile)(profile);
            return true;
        });
    },
    updateProfile(profile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(0, state_1.isKnown)(profile))
                throw new Error('Profile does not exist');
            (0, state_1.setProfile)(profile);
            return true;
        });
    },
    deleteProfile(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(0, state_1.ids)().includes(id))
                throw new Error('Profile does not exist');
            (0, state_1.setProfiles)((0, state_1.profiles)().filter(profile => profile.id !== id));
            return true;
        });
    }
};
//# sourceMappingURL=service.js.map