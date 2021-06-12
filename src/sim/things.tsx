import { KdTreeMap } from '@thi.ng/geom-accel';

// Helper type for a maybe-define for thing types
export type ThingHas<T> = Partial<Record<ThingType, T>>;

const getRes = (thing: Thing, resType: ThingType) => thing.resources[resType] ?? 0;
const mathRes = (thing: Thing, resType: ThingType, value: number) => {
	const newValue = getRes(thing, resType) + value;
	thing.resources[resType] = newValue;
	return newValue;
};

/**
 * Our simulation has a tick (current time) and things
 *
 * Things are organized into a 2D k-d tree (for now) with a collection of things to allow overlapping points
 *
 * There's a graph of connections between things as well for resource sharing / related components
*/
export type SimState = {
	things: KdTreeMap<number[], Thing[]>,
	tick: number
};


/**
 * A thing is something, somewhere, with some resources (which are counts of things)
 */
export type Thing = {
	type: ThingType,
	pos: number[],
	resources: ThingHas<number>,
};

export enum ThingType {
	Water = 'Water',
	Seed = 'Seed',
	Root = 'Root',
	Cloud = 'Cloud',
	RainCloud = 'RainCloud',
};

// Helpers for working with the stacked kd map
export const addThing = (thing: Thing, things: SimState['things']) => {
	const existing = things.get(thing.pos);
	if (existing !== undefined) {
		existing.push(thing);
	} else {
		things.set(thing.pos, [thing]);
	}
	return things;
};
export const removeThing = (thing: Thing, things: SimState['things']) => {
	const remaining = (things.get(thing.pos) ?? [])
		.filter(x => x !== thing);
	if (remaining.length) {
		things.set(thing.pos, remaining);
	} else {
		things.remove(thing.pos);
	}
	return things;
};


export type Control = (self: Thing, state: SimState, delta: number) => void;

// -------- Controls
const absorbWater: Control = (self: Thing, state: SimState) => {
	const DISTANCE = 2;
	const MAX_CELLS = (DISTANCE - 1) * 9;
	const nearestWater = state.things.queryValues(self.pos, 2, MAX_CELLS)
		.flat()
		.find(x => x.type === ThingType.Water);

	if (nearestWater) {
		removeThing(nearestWater, state.things);
		mathRes(self, ThingType.Water, 1);
	}
};

const rootDown: Control = (self: Thing, state: SimState) => {
	if (getRes(self, ThingType.Water) > 2) {
		const newRoot = root();
		newRoot.pos[0] = self.pos[0];
		newRoot.pos[1] = self.pos[1] + 1; // down 1
		addThing(newRoot, state.things);
		mathRes(self, ThingType.Water, -2);
	}
};

const condenseWater: Control = (self: Thing, state: SimState) => {
	// Gather water
	if (state.tick % 3 === 0) {
		mathRes(self, ThingType.Water, 5);
	}


	// Become a rain cloud
	if (getRes(self, ThingType.Water) > 10) {
		self.type = ThingType.RainCloud;
	}
};

const rain: Control = (self: Thing, state: SimState) => {
	let maxDrops = 4;
	while (maxDrops > 0 && getRes(self, ThingType.Water) > 0) {
		const newWater = water();
		newWater.pos[0] = self.pos[0];
		newWater.pos[1] = self.pos[1];
		addThing(newWater, state.things);
		mathRes(self, ThingType.Water, -1);
		maxDrops--;
	}

	// Become a cloud again
	if (self.resources[ThingType.Water] === 0) {
		self.type = ThingType.Cloud;
	}
};

export const FixedControls: ThingHas<Control[]> = {
	[ThingType.Seed]: [absorbWater, rootDown],
	[ThingType.Root]: [absorbWater],
	[ThingType.Cloud]: [condenseWater],
	[ThingType.RainCloud]: [rain],
};

// --------------------- Things
const baseThing = (pos: number[]) => ({
	resources: {},
	pos,
});

export const water = (pos: number[] = [0, 0]) => ({
	...baseThing(pos),
	type: ThingType.Water,
});

export const seed = (pos: number[] = [0, 0]) => ({
	...baseThing(pos),
	type: ThingType.Seed,
	resources: {
		[ThingType.Water]: 0,
	},
});

export const root = (pos: number[] = [0, 0]) => ({
	...baseThing(pos),
	type: ThingType.Root,
});

export const cloud = (pos: number[] = [0, 0]) => ({
	...baseThing(pos),
	type: ThingType.Cloud,
	resource: {
		[ThingType.Water]: 0,
	}
});