/**
 * LOCKSTEP INPUT SYNC (Deterministic)
 * Exchanges inputs only, simulates fixed 60fps frames when inputs for all players are available.
 */
(function(){
  window.flux = window.flux || {};

  // bits: 0=left 1=right 2=up 3=down 4=attack 5=dash 6=hop
  function packFromInputState(state){
    let b = 0;
    const x = state.x || 0;
    const y = state.y || 0;
    if (x < -0.35) b |= 1<<0;
    if (x >  0.35) b |= 1<<1;
    if (y < -0.35) b |= 1<<2;
    if (y >  0.35) b |= 1<<3;
    if (state.attack) b |= 1<<4;
    if (state.dash)   b |= 1<<5;
    if (state.hop)    b |= 1<<6;
    return b>>>0;
  }

  const INV_SQRT2 = 0.7071067811865476;

  class LockstepController {
    constructor(player, slot){
      this.player = player;
      this.slot = slot;
      this.state = {x:0,y:0,attack:false,dash:false,hop:false};
      this.lastState = {x:0,y:0,attack:false,dash:false,hop:false};
    }
    setBits(bits){
      this.lastState = { ...this.state };
      const left  = !!(bits & (1<<0));
      const right = !!(bits & (1<<1));
      const up    = !!(bits & (1<<2));
      const down  = !!(bits & (1<<3));
      let x = (right?1:0) + (left?-1:0);
      let y = (down?1:0)  + (up?-1:0);
      // Normalize diagonals to match Input system
      if (x !== 0 && y !== 0){
        x *= INV_SQRT2;
        y *= INV_SQRT2;
      }
      this.state = {
        x, y,
        attack: !!(bits & (1<<4)),
        dash:   !!(bits & (1<<5)),
        hop:    !!(bits & (1<<6))
      };
    }
    isJustPressed(btn){
      return !!this.state[btn] && !this.lastState[btn];
    }
    isPressed(btn){
      return !!this.state[btn];
    }
    update(dt){
      if (this.player) this.player.update(dt, this);
    }
  }

  class Lockstep {
    constructor(opts){
      this.slot = opts.slot|0;
      this.playerCount = opts.playerCount|0;
      this.send = opts.send; // function(msg)
      this.onFrame = opts.onFrame; // function(frame, bitsBySlot)
      this.inputDelay = (opts.inputDelay ?? 2)|0;
      this.frame = 0;
      this.inputs = Array.from({length:this.playerCount}, ()=> ({}));
      this.lastBits = new Array(this.playerCount).fill(0);
      this.dt = 1/60;
    }

    submitLocalFromInput(input){
      const bits = packFromInputState(input.state || {});
      const f = this.frame + this.inputDelay;
      this.inputs[this.slot][f] = bits;
      this.lastBits[this.slot] = bits;
      if (this.send){
        this.send({type:'LSI', f, s:this.slot, b:bits});
      }
    }

    onNet(msg){
      if (!msg || msg.type !== 'LSI') return;
      const f = msg.f|0;
      const s = msg.s|0;
      const b = (msg.b>>>0);
      if (s<0 || s>=this.playerCount) return;
      this.inputs[s][f] = b;
      this.lastBits[s] = b;
    }

    hasAll(frame){
      for (let s=0;s<this.playerCount;s++){
        if (this.inputs[s][frame] === undefined) return false;
      }
      return true;
    }

    tick(){
      while (this.hasAll(this.frame)){
        const bitsBySlot = [];
        for (let s=0;s<this.playerCount;s++){
          bitsBySlot[s] = this.inputs[s][this.frame]>>>0;
        }
        if (this.onFrame) this.onFrame(this.frame, bitsBySlot, this.dt);
        this.frame++;
      }
    }
  }

  window.flux.Lockstep = Lockstep;
  window.flux.LockstepController = LockstepController;
})();
