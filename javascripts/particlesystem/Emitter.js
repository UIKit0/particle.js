(function() {
	this.pjs = this.pjs || {};

	/*
	 * Given a vector of any length, returns a vector
	 * pointing in the same direction but with a magnitude of 1
	 */
	function normalize(vector) {
		var length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);

		vector.x /= length;
		vector.y /= length;
	}

	pjs.Emitter = function(config) {
		this.reconfigure(config || {});
	};

	pjs.Emitter.prototype = {

		/*
		 * Applies all the properties in config to the particle system,
		 * a good way to change just one or two things about the system
		 * on the fly
		 */
		overlay: function(config) {
			pjs.extend(this, config);
			this.reset();
		},

		/*
		 * completely reconfigures the particle system. First applies all 
		 * the defaults, then overlays everything found in config
		 */
		reconfigure: function(config) {
			this._totalParticles = 0;
			this.emissionRate = 0;

			this.active = false;
			this.duration = Infinity;

			this.pos = {
				x: 0,
				y: 0
			};
			this.posVar = {
				x: 0,
				y: 0
			};
			this.posVarTransformFn = null;

			this.angle = 0;
			this.angleVar = 0;

			this.life = 0;
			this.lifeVar = 0;

			this.radius = 0;
			this.radiusVar = 0;

			this.texture = null;
			this.textureEnabled = false;
			this.textureAdditive = false;

			this.startScale = 0;
			this.startScaleVar = 0;
			this.endScale = 0;
			this.endScaleVar = 0;

			this.startColor = [0, 0, 0, 0];
			this.startColorVar = [0, 0, 0, 0];
			this.endColor = [0, 0, 0, 0];
			this.endColorVar = [0, 0, 0, 0];

			this.gravity = {
				x: 0,
				y: 0
			};
			this.radialAccel = 0;
			this.radialAccelVar = 0;
			this.tangentialAccel = 0;
			this.tangentialAccelVar = 0;

			pjs.extend(this, config);

			this.reset();
		},

		/*
		 * flushes out the particle pool and starts the system over
		 * from the beginning. Replacing all the particles with new ones
		 * is a bit nuclear, but gets the job done
		 */
		reset: function() {
			this._particlePool = [];

			for (var i = 0; i < this.totalParticles; ++i) {
				this._particlePool.push(new pjs.Particle());
			}

			this._particleCount = 0;
			this._particleIndex = 0;
			this._elapsed = 0;
			this._emitCounter = 0;
		},

		/*
		 * Returns whether all the particles in the pool are currently active
		 */
		_isFull: function() {
			return this._particleCount === this.totalParticles;
		},

		/*
		 * Takes a dormant particle out of the pool and makes it active.
		 * Does nothing if there is no free particle availabe
		 */
		_addParticle: function() {
			if (this._isFull()) {
				return false;
			}

			var p = this._particlePool[this._particleCount];
			this._initParticle(p); ++this._particleCount;

			return true;
		},

		/*
		 * Initializes the particle based on the current settings
		 * of the particle system
		 */
		_initParticle: function(particle) {
			particle.texture = this.texture;
			particle.textureEnabled = this.textureEnabled;
			particle.textureAdditive = this.textureAdditive;

			var posVar = {
				x: this.posVar.x * pjs.random11(),
				y: this.posVar.y * pjs.random11()
			};

			if (this.posVarTransformFn) {
				posVar = this.posVarTransformFn(posVar);
			}

			particle.pos.x = this.pos.x + posVar.x;
			particle.pos.y = this.pos.y + posVar.y;

			var angle = this.angle + this.angleVar * pjs.random11();
			var speed = this.speed + this.speedVar * pjs.random11();

			// it's easier to set speed and angle at this level
			// but once the particle is active and being updated, it's easier
			// to use a vector to indicate speed and angle. So particle.setVelocity
			// converts the angle and speed values to a velocity vector
			particle.setVelocity(angle, speed);

			particle.radialAccel = this.radialAccel + this.radialAccelVar * pjs.random11() || 0;
			particle.tangentialAccel = this.tangentialAccel + this.tangentialAccelVar * pjs.random11() || 0;

			var life = this.life + this.lifeVar * pjs.random11() || 0;
			particle.life = Math.max(0, life);

			particle.scale = pjs.isNumber(this.startScale) ? this.startScale: 1;
			particle.deltaScale = pjs.isNumber(this.endScale) ? (this.endScale - this.startScale) : 0;
			particle.deltaScale /= particle.life;

			particle.radius = pjs.isNumber(this.radius) ? this.radius + (this.radiusVar || 0) * pjs.random11() : 0;

			// color
			// note that colors are stored as arrays => [r,g,b,a],
			// this makes it easier to tweak the color every frame in _updateParticle
			// The renderer will take this array and turn it into a css rgba string
			if (this.startColor) {
				var startColor = [
				this.startColor[0] + this.startColorVar[0] * pjs.random11(), this.startColor[1] + this.startColorVar[1] * pjs.random11(), this.startColor[2] + this.startColorVar[2] * pjs.random11(), this.startColor[3] + this.startColorVar[3] * pjs.random11()];

				// if there is no endColor, then the particle will end up staying at startColor the whole time
				var endColor = startColor;
				if (this.endColor) {
					endColor = [
					this.endColor[0] + this.endColorVar[0] * pjs.random11(), this.endColor[1] + this.endColorVar[1] * pjs.random11(), this.endColor[2] + this.endColorVar[2] * pjs.random11(), this.endColor[3] + this.endColorVar[3] * pjs.random11()];
				}

				particle.color = startColor;
				particle.deltaColor = [(endColor[0] - startColor[0]) / particle.life, (endColor[1] - startColor[1]) / particle.life, (endColor[2] - startColor[2]) / particle.life, (endColor[3] - startColor[3]) / particle.life];
			}
		},

		/*
		 * Updates a particle based on how much time has passed in delta
		 * Moves the particle using its velocity and all forces acting on it (gravity,
		 * radial and tangential acceleration), and updates all the properties of the
		 * particle like its size, color, etc
		 */
		_updateParticle: function(p, delta, i) {
			if (p.life > 0) {

				// these vectors are stored on the particle so we can reuse them, avoids
				// generating lots of unnecessary objects each frame
				p.forces = p.forces || {
					x: 0,
					y: 0
				};
				p.forces.x = 0;
				p.forces.y = 0;

				p.radial = p.radial || {
					x: 0,
					y: 0
				};
				p.radial.x = 0;
				p.radial.y = 0;

				// dont apply radial forces until moved away from the emitter
				if ((p.pos.x !== this.pos.x || p.pos.y !== this.pos.y) && (p.radialAccel || p.tangentialAccel)) {
					p.radial.x = p.pos.x - this.pos.x;
					p.radial.y = p.pos.y - this.pos.y;

					normalize(p.radial);
				}

				p.tangential = p.tangential || {
					x: 0,
					y: 0
				};
				p.tangential.x = p.radial.x;
				p.tangential.y = p.radial.y;

				p.radial.x *= p.radialAccel;
				p.radial.y *= p.radialAccel;

				var newy = p.tangential.x;
				p.tangential.x = - p.tangential.y;
				p.tangential.y = newy;

				p.tangential.x *= p.tangentialAccel;
				p.tangential.y *= p.tangentialAccel;

				p.forces.x = p.radial.x + p.tangential.x + this.gravity.x;
				p.forces.y = p.radial.y + p.tangential.y + this.gravity.y;

				p.forces.x *= delta;
				p.forces.y *= delta;

				p.vel.x += p.forces.x;
				p.vel.y += p.forces.y;

				p.pos.x += p.vel.x * delta;
				p.pos.y += p.vel.y * delta;

				p.life -= delta;

				p.scale += p.deltaScale * delta;

				if (p.color) {
					p.color[0] += p.deltaColor[0] * delta;
					p.color[1] += p.deltaColor[1] * delta;
					p.color[2] += p.deltaColor[2] * delta;
					p.color[3] += p.deltaColor[3] * delta;
				}

				++this._particleIndex;
			} else {
				// the particle has died, time to return it to the particle pool
				// take the particle at the current index
				var temp = this._particlePool[i];

				// and move it to the end of the active particles, keeping all alive particles pushed
				// up to the front of the pool
				this._particlePool[i] = this._particlePool[this._particleCount - 1];
				this._particlePool[this._particleCount - 1] = temp;

				// decrease the count to indicate that one less particle in the pool is active.
				--this._particleCount;
			}
		},

		_updateFrameRate: function(delta) {
			++this.frames;
			this.fpsElapsed += delta;

			// if more than 2 seconds has passed, update the current fps value
			if (this.fpsElapsed > 2 && this.fpsContainer) {
				var fps = this.frames / this.fpsElapsed;
				fps = Math.round(fps * 100) / 100;
				this.fpsContainer.innerHTML = fps + ' fps';
				this.fpsElapsed = 0;
				this.frames = 0;
			}
		},

		update: function(delta) {
			if (!this.active) {
				return;
			}

			this._updateFrameRate(delta);

			if (this.emissionRate) {
				// emit new particles based on how much time has passed and the emission rate
				var rate = 1.0 / this.emissionRate;
				this._emitCounter += delta;

				while (!this._isFull() && this._emitCounter > rate) {
					this._addParticle();
					this._emitCounter -= rate;
				}
			}

			this._elapsed += delta;
			this.active = this._elapsed < this.duration;

			this._particleIndex = 0;

			while (this._particleIndex < this._particleCount) {
				var p = this._particlePool[this._particleIndex];
				this._updateParticle(p, delta, this._particleIndex);
			}
		},

		setFpsContainer: function(el) {
			this.fpsContainer = el;
			this.frames = 0;
			this.fpsElapsed = 0;
		}
	};

	Object.defineProperty(pjs.Emitter.prototype, 'particles', {
		get: function() {
			return this._particlePool;
		}
	});

	Object.defineProperty(pjs.Emitter.prototype, 'totalParticles', {
		get: function() {
			return this._totalParticles;
		},
		set: function(tp) {
			tp = tp | 0;
			if(tp !== this._totalParticles) {
				this._totalParticles = tp;
				this.reset();
			}
		}
	});
})();

