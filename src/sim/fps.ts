export class Fps {
	time = Date.now();
	rate = 0;
	fps = 0;

	zero() {
		this.time = Date.now();
	}

	update() {
		const now = Date.now();
		this.rate = Math.max(1, now - this.time);
		this.fps = 1000 / Math.max(1, now - this.time);
		this.time = now;
	}


}
