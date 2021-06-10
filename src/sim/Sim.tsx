import React from 'react';
import produce, { current } from 'immer';
import type { Draft } from 'immer';
import { KdTreeMap } from '@thi.ng/geom-accel';

// Helper type for a maybe-define for thing types
export type ThingHas<T> = Partial<Record<ThingType, T>>;

/**
 * Our simulation has a tick (current time) and things
 *
 * Things are organized into a 2D k-d tree (for now) with a collection of things to allow overlapping points
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
};

// Helpers for working with the stacked kd map
const addThing = (thing: Thing, things: SimState['things']) => {
	const existing = things.get(thing.pos);
	if (existing !== undefined) {
		existing.push(thing);
	} else {
		things.set(thing.pos, [thing]);
	}
	return things;
}
const removeThing = (thing: Thing, things: SimState['things']) => {
	const remaining = (things.get(thing.pos) ?? [])
		.filter(x => x !== thing);
	if (remaining.length) {
		things.set(thing.pos, remaining);
	} else {
		things.remove(thing.pos);
	}
	return things;
}


export type Control = (self: Thing, draft: Draft<SimState>, delta: number) => void;

// -------- Controls
const absorbWater: Control = (self: Thing, draft: Draft<SimState>, delta: number) => {
	const state = current(draft) as SimState;
	const nearestWater = state.things.queryValues(self.pos, 2)
		.flat()
		.find(x => x.type === ThingType.Water);

	if (nearestWater) {
		removeThing(nearestWater, state.things);
		self.resources[ThingType.Water] = (self.resources?.[ThingType.Water] ?? 0) + 1
	}
};

export const FixedControls: ThingHas<Control[]> = {
	[ThingType.Seed]: [absorbWater],
};

// --------------------- Things


const baseThing = () => ({
	resources: {},
	controls: [],
	pos: [0, 0],
})

const water = () => ({
	...baseThing(),
	type: ThingType.Water,
});

const seed = () => ({
	...baseThing(),
	type: ThingType.Seed,
	resources: {
		[ThingType.Water]: 0,
	},
});

export type SimProps = {};
export type SerializedSimState = string;
const serializeState = (state: SimState): SerializedSimState => {
	return JSON.stringify({
		...state,
		things: [...state.things],
	});
};
const deserializeState = (serialized: string): SimState => {
	const intermediate = JSON.parse(serialized);

	// Deserialize things
	const interThings = (intermediate.things as [number[], Thing[]][]);
	const things = new KdTreeMap(2, interThings);
	return {
		tick: intermediate.tick as number,
		things,
	};
};

const advanceSim = (state: SimState, delta: number): SimState => produce(state, (draftState) => {
	state.tick += delta;
	for (const [, things] of state.things) {
		things.forEach(thing => {
			(FixedControls[thing.type] ?? []).forEach((ctrl) => ctrl(thing, draftState, delta));
		})
	}
});

const emptyState = () => ({
	things: [
		water(),
		water(),
		water(),
		water(),
		water(),
		//
		seed(),
	].reduce((thingMap, thing) => addThing(thing, thingMap), new KdTreeMap<number[], Thing[]>(2)),
	tick: 0,
});

/*
-------- whatever
*/

const DisplayThing = ({ thing }: { thing: Thing }) => (
	<div>
		{thing.type}
		<ul className="thing-list">
			{Object.keys(thing.resources).map((key) => (
				<li key={key}>{key}: {String(thing.resources[key as ThingType])}</li>
			))}
		</ul>
	</div>
);

const STORAGE = 'SIM_STORAGE';
export class Sim extends React.Component<SimProps, SimState> {
	interval: NodeJS.Timeout | undefined;

	constructor(initialProps: SimProps) {
		super(initialProps);
		this.state = emptyState();

		const saved = sessionStorage.getItem(STORAGE);
		if (saved) {
			try {
				console.log(saved);
				this.state = deserializeState(saved);
			} catch (error) {
				console.debug(saved);
				console.warn('Failed to load json', error);
			}
		}
	}

	componentDidMount() {
		this.interval = setInterval(() => {
			const nextState = advanceSim(this.state, 1);

			if (this.state.tick % 10 === 0) {
				sessionStorage.setItem(STORAGE, serializeState(nextState));
			}

			this.setState(nextState);
		}, 1000);
	}

	componentWillUnmount() {
		if (this.interval !== undefined) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
	}

	render() {
		return (
			<div>
				<p>{this.state.tick}</p>
				{[...this.state.things.values()].flatMap((things, i) => (
					things.map((thing, j) => (
						<DisplayThing thing={thing} key={`${i},${j}`} />
					))
				))}
				<button onClick={() => this.setState(emptyState())}>Reset</button>
			</div>
		);
	}
}