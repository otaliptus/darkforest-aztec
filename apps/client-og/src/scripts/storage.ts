import { Fr } from "@aztec/aztec.js/fields";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";
import type { AztecAddress } from "@aztec/aztec.js/addresses";
import type { AztecNode } from "@aztec/stdlib/interfaces/aztec-node";
import type { OnChainConfig } from "./types";

export type StorageSlots = Record<string, bigint>;

type StorageFieldEntry = {
    name: string;
    value?: {
        fields?: Array<{ name: string; value?: { value?: string } }>;
        value?: string;
    };
};

type StorageContractEntry = {
    fields?: Array<{ name: string; value?: { value?: string; fields?: StorageFieldEntry[] } }>;
};

export const requireSlot = (slots: StorageSlots, name: string) => {
    const slot = slots[name];
    if (slot === undefined) {
        throw new Error(`Missing storage slot for ${name}.`);
    }
    return slot;
};

const parseSlotValue = (value: string | undefined) => {
    if (!value) {
        return undefined;
    }
    return BigInt(`0x${value}`);
};

export const getStorageSlots = (artifact: any, contractName: string): StorageSlots => {
    const storage = artifact?.outputs?.globals?.storage;
    if (!Array.isArray(storage)) {
        throw new Error("Contract artifact missing storage layout.");
    }

    const entry = (storage as StorageContractEntry[]).find((item) =>
        item.fields?.some(
            (field) => field.name === "contract_name" && field.value?.value === contractName
        )
    );
    if (!entry) {
        throw new Error(`Storage layout not found for ${contractName}.`);
    }

    const fields = entry.fields?.find((field) => field.name === "fields")?.value?.fields;
    if (!Array.isArray(fields)) {
        throw new Error(`Storage layout missing fields for ${contractName}.`);
    }

    const slots: StorageSlots = {};
    for (const field of fields as StorageFieldEntry[]) {
        const slotValue = field.value?.fields?.find((slot) => slot.name === "slot")?.value?.value;
        const parsed = parseSlotValue(slotValue);
        if (parsed !== undefined) {
            slots[field.name] = parsed;
        }
    }

    return slots;
};

export const readPublicField = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    slot: bigint
) => {
    const value = await node.getPublicStorageAt("latest", contractAddress, new Fr(slot));
    return value.toBigInt();
};

export const readPublicFields = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    baseSlot: bigint,
    count: number
) => {
    const reads = Array.from({ length: count }, (_, index) =>
        readPublicField(node, contractAddress, baseSlot + BigInt(index))
    );
    return Promise.all(reads);
};

export const readPublicMapFields = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    mapSlot: bigint,
    key: { toField: () => Fr },
    count: number
) => {
    const slot = await deriveStorageSlotInMap(new Fr(mapSlot), key);
    return readPublicFields(node, contractAddress, slot.toBigInt(), count);
};

export const readPublicMapField = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    mapSlot: bigint,
    key: { toField: () => Fr }
) => {
    const [value] = await readPublicMapFields(node, contractAddress, mapSlot, key, 1);
    return value;
};

export const readGameConfig = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots
): Promise<OnChainConfig> => {
    const configSlot = requireSlot(storageSlots, "config");
    const [
        planethashKey,
        spacetypeKey,
        biomebaseKey,
        perlinLengthScale,
        perlinMirrorXRaw,
        perlinMirrorYRaw,
        initPerlinMin,
        initPerlinMax,
        worldRadius,
        spawnRimArea,
        locationRevealCooldown,
        timeFactorHundredths,
        planetRarity,
        maxLocationId,
    ] = await readPublicFields(node, contractAddress, configSlot, 14);

    const configHashSpacetype = await readPublicField(
        node,
        contractAddress,
        requireSlot(storageSlots, "config_hash_spacetype")
    );
    const configHashBiome = await readPublicField(
        node,
        contractAddress,
        requireSlot(storageSlots, "config_hash_biome")
    );

    return {
        planethashKey,
        spacetypeKey,
        biomebaseKey,
        perlinLengthScale,
        perlinMirrorX: perlinMirrorXRaw === 1n,
        perlinMirrorY: perlinMirrorYRaw === 1n,
        initPerlinMin,
        initPerlinMax,
        worldRadius,
        spawnRimArea,
        locationRevealCooldown,
        timeFactorHundredths,
        planetRarity,
        maxLocationId,
        configHashSpacetype,
        configHashBiome,
    };
};
