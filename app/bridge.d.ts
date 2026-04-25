import {DataStore} from "@api/index";
import type {Organ} from "@api/model/organ";

export type Bridge = { organs: DataStore<Organ> };
