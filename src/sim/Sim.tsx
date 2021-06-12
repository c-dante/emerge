import React from 'react';
import fp from 'lodash/fp';
import { KdTreeMap } from '@thi.ng/geom-accel';
import { CanvasRender } from './render';

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
const addThing = (thing: Thing, things: SimState['things']) => {
	const existing = things.get(thing.pos);
	if (existing !== undefined) {
		existing.push(thing);
	} else {
		things.set(thing.pos, [thing]);
	}
	return things;
};
const removeThing = (thing: Thing, things: SimState['things']) => {
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

const water = (pos: number[] = [0, 0]) => ({
	...baseThing(pos),
	type: ThingType.Water,
});

const seed = (pos: number[] = [0, 0]) => ({
	...baseThing(pos),
	type: ThingType.Seed,
	resources: {
		[ThingType.Water]: 0,
	},
});

const root = (pos: number[] = [0, 0]) => ({
	...baseThing(pos),
	type: ThingType.Root,
});

const cloud = (pos: number[] = [0, 0]) => ({
	...baseThing(pos),
	type: ThingType.Cloud,
	resource: {
		[ThingType.Water]: 0,
	}
});


// -- Sim
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

const advanceSim = (state: SimState, delta: number): SimState => {
	state.tick += delta;
	for (const [, things] of state.things) {
		// Randomly shuffle the things so we don't bias who goes first
		fp.shuffle(things).forEach(thing => {
			(FixedControls[thing.type] ?? []).forEach((ctrl) => ctrl(thing, state, delta));
		});
	}
	return state;
};

const emptyState = () => ({
	things: [
		water(),
		water(),
		water(),
		water(),
		water(),
		// A seed
		seed(),
		// A cloud
		cloud(),
	].reduce((thingMap, thing) => addThing(thing, thingMap), new KdTreeMap<number[], Thing[]>(2)),
	tick: 0,
});

/*
-------- whatever. render and game loop
*/

// const DisplayThing = ({ thing }: { thing: Thing }) => (
// 	<div style={{
// 		position: 'absolute',
// 		left: thing.pos[0] * 50,
// 		top: thing.pos[1] * 50,
// 	}}>
// 		{thing.type}
// 		<ul className="thing-list">
// 			{Object.keys(thing.resources).map((key) => (
// 				<li key={key}>{key}: {String(thing.resources[key as ThingType])}</li>
// 			))}
// 		</ul>
// 	</div>
// );

const STORAGE = 'SIM_STORAGE';
export type SimEltState = {
	sim: SimState;
	intervalRate: number;
	canvasRect?: DOMRectReadOnly;
}
export type SimProps = {};
export class Sim extends React.Component<SimProps, SimEltState> {
	interval: NodeJS.Timeout | undefined;

	constructor(initialProps: SimProps) {
		super(initialProps);
		this.state = {
			sim: emptyState(),
			intervalRate: 1000,
		};

		const saved = sessionStorage.getItem(STORAGE);
		if (saved) {
			try {
				console.log(saved);
				this.setState({
					sim: deserializeState(saved),
				});
			} catch (error) {
				console.debug(saved);
				console.warn('Failed to load json', error);
			}
		}
	}

	componentDidMount() {
		this.interval = setInterval(() => {
			const nextState = advanceSim(this.state.sim, 1);

			if (this.state.sim.tick % 10 === 0) {
				sessionStorage.setItem(STORAGE, serializeState(nextState));
			}

			this.setState({
				sim: { ...nextState },
			});
		}, 1000);
	}

	componentWillUnmount() {
		if (this.interval !== undefined) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
	}

	setCanvasDims(rect: DOMRectReadOnly) {
		this.setState({
			canvasRect: rect,
		});
	}

	render() {
		return (
			<div className="sim-container">
				<div className="sim-render-area">
					<CanvasRender state={this.state.sim} onResize={dims => this.setCanvasDims(dims)} />
					{/* {[...this.state.things.values()].flatMap((things, i) => (
						things.map((thing, j) => (
							<DisplayThing thing={thing} key={`${i},${j}`} />
						))
					))} */}
				</div>

				<div className="sim-stats-footer">
					<p>{this.state.sim.tick}</p>
					<button onClick={() => this.setState({ sim: emptyState()} )}>Reset</button>
					<p>Size: {this.state.canvasRect?.width} x {this.state.canvasRect?.height}</p>
					{/* <label>
						interval (ms)
						<input type='text' value={this.intervalRate} />
					</label> */}
				</div>
			</div>
		);
	}
}
