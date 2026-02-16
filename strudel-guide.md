# Strudel Music Reference

Strudel is a live coding music platform. `.strudel` files are plain JavaScript evaluated in Strudel's REPL. All functions are globally available — no imports needed.

**IMPORTANT: Use `$:` blocks for each instrument/voice, NOT `stack()`.** Each `$:` line is an independent pattern that plays simultaneously. This is the standard way to structure tracks:

```js
samples('github:tidalcycles/dirt-samples')
setcps(120/60/4)  // 120 BPM

$: s("bd sd bd sd").bank("RolandTR808")       // drums
$: note("c2 c2 ab1 bb1").sound("sawtooth")    // bass
$: note("[c3,eb3,g3]").sound("supersaw").lpf(1200) // chords
```

## Core Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `note("c3 e3 g3")` | Play notes | `note("c3 e3 g3 b3")` |
| `s("bd sd")` | Trigger samples | `s("bd sd hh sd")` |
| `n("0 2 4")` | Sample variation or scale degree | `n("0 2 4").scale("C:minor")` |
| `$: pattern` | Independent voice/instrument block | `$: s("bd sd hh sd")` |
| `stack(p1, p2)` | Combine patterns within one `$:` block | `$: stack(s("bd sd"), s("hh*8"))` |
| `cat(p1, p2)` | Each pattern gets 1 cycle | `cat("c3","e3","g3").note()` |
| `seq(p1, p2)` | Squeeze all into 1 cycle | `seq("c3","e3","g3").note()` |
| `silence` | Mute a line | |

## Mini-Notation

| Symbol | Meaning | Example |
|--------|---------|---------|
| ` ` (space) | Sequence equally in cycle | `"c3 e3 g3"` |
| `[x y]` | Subdivide into one step | `"c3 [e3 g3] b3"` |
| `<x y>` | Alternate per cycle | `"<c3 e3 g3>"` |
| `x*n` | Repeat/speed up | `"hh*8"` |
| `x/n` | Slow down | `"[c3 e3 g3]/2"` |
| `~` | Rest | `"bd ~ sd ~"` |
| `x,y` | Polyphony (chord) | `"[c3,e3,g3]"` |
| `x@n` | Elongate | `"c3@3 e3"` (c3 gets 3/4) |
| `x!n` | Repeat without speeding | `"c3!3 e3"` |
| `x?` | 50% random drop | `"hh*8?"` |
| `x\|y` | Random choice | `"bd \| cp"` |
| `(k,n)` | Euclidean rhythm | `"bd(3,8)"` |
| `x:n` | Sample variation | `"hh:0 hh:1 hh:2"` |

## Time Transforms

```js
.fast(2)  .slow(2)  .rev()  .palindrome()
.early(0.25)  .late(0.25)  .iter(4)
.ply("<1 2 3>")  .linger(.25)  .cpm(120)
```

## Conditional Modifiers

```js
.every(4, rev)                  // every 4th cycle
.every(3, x => x.fast(2))      // lambda form
.sometimes(rev)                 // 50% chance per event
.often(rev)  .rarely(rev)       // 75% / 25%
.sometimesBy(0.3, rev)          // custom probability
.someCycles(rev)                // 50% per cycle
.degradeBy(0.5)                 // remove 50% of events
.struct("t [t f] t f")          // rhythmic structure
.mask("1 1 0 1")                // silence where 0
```

## Effects

```js
// Filters
.lpf(2000)  .lpq(5)  .hpf(500)  .bpf(1000)  .vowel("a e i o")

// Amplitude
.gain(0.8)  .attack(.01)  .decay(.1)  .sustain(.5)  .release(.2)

// Spatial
.pan(0.5)  .room(0.5)  .roomsize(3)
.delay(0.5)  .delaytime(0.375)  .delayfeedback(0.5)

// Distortion
.crush(4)  .distort(3)  .shape(0.5)

// Stereo
.jux(rev)  .juxBy(0.5, rev)
```

## Signals (Continuous Modulators)

```js
sine  cosine  saw  tri  square  rand  perlin  // all 0-1
sine.range(200, 4000).slow(8)  // map to range, slow down

// Usage:
.lpf(sine.range(500, 4000).slow(16))  // sweeping filter
.pan(sine.range(.3, .7).slow(7))      // autopan
```

## Scales and Notes

```js
n("0 2 4 6").scale("C:minor")
// Scales: major minor dorian mixolydian lydian phrygian blues pentatonic
note("c3 e3 g3").transpose(7)
n("0 2 4").scale("C:major").scaleTranspose("<0 -1 -2>")
chord("<C^7 Am7 Dm7 G7>").voicing()
```

## Synths

```js
note("c3 e3").sound("sawtooth")  // or: sine square triangle supersaw
note("c3 e3").sound("sine").fm(4).fmh(1.5).fmdecay(.1)  // FM synthesis
```

## Common Samples

| Name | Sound | Name | Sound |
|------|-------|------|-------|
| `bd` | Kick | `sd` | Snare |
| `hh` | Hi-hat | `oh` | Open hat |
| `cp` | Clap | `cr` | Crash |
| `rd` | Ride | `rim` | Rimshot |
| `lt` `mt` `ht` | Toms | `cb` | Cowbell |

```js
s("bd sd").bank("RolandTR808")   // use specific drum machine banks
s("bd sd").bank("RolandTR909")
```

## Sample Packs

Load with `samples('github:user/repo')`. Default samples (bd, sd, hh, piano, etc.) are built-in — no call needed.

### Electronic / Production Kits

| Call | Description |
|------|-------------|
| `samples('github:vasilymilovidov/samples')` | Clean electronic kit: `kik` (25 kicks), `prc` (26 percussion), `b1`/`b2`/`b3` (chromatic bass synths), `ky1` (chromatic keys), `ns1` (noise textures), `ir` (impulse responses) |
| `samples('github:eddyflux/crate')` | Massive curated drums: `crate_bd` (52), `crate_sd` (54), `crate_hh` (49), `crate_oh` (34), `crate_cp` (37), `crate_perc` (40), `crate_cr` (16), `crate_rd` (20), `crate_rim`, `crate_sh`, `crate_tb`, `crate_stick`, `crate_block`, `crate_bell`, `crate_clave`, `crate_conga`, `crate_bongo`, `crate_djembe` |
| `samples('github:emrexdeger/strudelSamples')` | Electronic production kit: `k` (8 kicks), `s` (7 snares), `ch` (7 hats), `oh`, `clap`, `perc` (12), `ride`, `tom`, `syn` (7 synths), `pad` (4), `b` (3 bass), `scape` (6 soundscapes) |
| `samples('github:mot4i/garden')` | Electronic drums + extras: `garden_bd` (10), `garden_sd` (4), `garden_hh` (4), `garden_oh`, `garden_cp` (5), `garden_cr`, `garden_rim` (5), `garden_lt` (7), `fx` (noise/sub/vinyl/sirene), `strings` (6 textures), `metal` (2), `loop` (4 acid loops) |

### Wavetables (Dough-Waveforms)

Load with `samples('github:Bubobubobubobubo/Dough-Waveforms')`. All `wt_*` samples auto-loop and can be pitched with `note()`. Scan through frames with `.n()`.

| Wavetable | Variations | Character |
|-----------|-----------|-----------|
| `wt_dbass` | 70 | Deep bass — great for wobble when scanning with `.n(sine.range(0,69).fast(2))` |
| `wt_ebass` | 71 | Electric bass |
| `wt_distorted` | 45 | Aggressive distorted — good for growl bass |
| `wt_raw` | 36 | Harsh, unprocessed — neuro bass source |
| `wt_bw_saw` | 50 | Sawtooth variations |
| `wt_bw_sawbright` | 10 | Bright saws |
| `wt_bw_squ` | 100 | Square wave variations |
| `wt_fmsynth` | varies | FM synth textures |
| `wt_bitreduced` | varies | Lo-fi aggressive |
| `wt_oscchip` | 158 | Chiptune oscillators |
| `wt_granular` | varies | Granular textures |

### Bass Samples in dirt-samples

Already available with `samples('github:tidalcycles/dirt-samples')`:

| Sound | Count | Description |
|-------|-------|-------------|
| `jungbass` | 20 | Sub-bass, 808 subs, jungle bass — `:0` deep_n_low, `:4` gliding 808, `:11` tekstep foghorn |
| `bass2` | 5 | Hardcore/aggressive bass |
| `hoover` | 6 | Classic rave/DnB mentasm stabs |
| `wobble` | 1 | Sub-bass wobble hit |
| `moog` | 7 | Moog synth notes (C2-C4, G1-G4) |
| `bass1` | 30 | Synth bass sounds |
| `bass3` | 11 | Bass sounds inc. reverse |
| `jvbass` | 13 | Synth bass notes |

### Classic / Breaks / Specialty

| Call | Description |
|------|-------------|
| `samples('github:tidalcycles/Dirt-Samples')` | Classic TidalCycles library — hundreds of drums, bass, breaks, vocals, FX. Notable keys: `industrial`, `techno`, `noise`, `metal`, `glitch`, `gabba`, `hardkick`, `rave`, `stab`, `hoover`, `dist` |
| `samples('github:yaxu/clean-breaks/main')` | Clean breakbeats for jungle/breakbeat |
| `samples('github:Bubobubobubobubo/Dough-Amen')` | 80 amen break variations across `amen1`/`amen2`/`amen3` — includes distorted, lo-fi, idm, jungle, rough variants |
| `samples('github:cleary/samples-flbass')` | Fretless bass, multisampled (CC0) |
| `samples('github:switchangel/pad')` | Synth pad textures |
| `samples('github:fjpolo/fjpolo-Strudel')` | Industrial metal textures: `anvil` (2), `chains` (1), `metalgrinder` (1) |
| `samples('github:prismograph/departure')` | `short` (8 hits), `breaks` (8 loops), `bass` (3), `pad` (1 Yamaha DX) |
| `samples('github:TristanCacqueray/mirus')` | 3 impulse responses + `haunted` chromatic instrument (C2-C4) |

### Freesound.org via Shabda

Random samples by keyword — different results each reload:
```js
samples('shabda:keyword:count')
samples('shabda:industrial:4,techno-kick:4,metal-hit:3')
// Useful keywords: industrial, techno, kick, percussion, distorted,
// noise, machine, factory, drone, dark-ambient, glitch, modular
```

### Cherry-pick Individual Samples

```js
samples({
  bd: 'bd/BT0AADA.wav',
  sd: 'sd/rytm-01-classic.wav',
}, 'github:tidalcycles/Dirt-Samples/master/')
```

## Drum Machine Banks

72 drum machines available via `.bank("Name")`. All use standard sample names (`bd`, `sd`, `hh`, `oh`, `cp`, `cr`, `rd`, `rim`, `ht`, `mt`, `lt`, `cb`, `sh`).

**Roland:** RolandTR808, RolandTR909, RolandTR606, RolandTR505, RolandTR707, RolandTR626, RolandTR727, RolandMC202, RolandMC303, RolandCompurhythm78, RolandCompurhythm1000, RolandCompurhythm8000, RolandR8, RolandS50, RolandD110, RolandD70, RolandDDR30, RolandJD990, RolandMT32, RolandSH09, RolandSystem100

**Linn:** LinnDrum, LinnLM1, LinnLM2, Linn9000

**Others:** OberheimDMX, SimmonsSDS5, SimmonsSDS400, EmuDrumulator, EmuSP12, EmuModular, SergeModular, DoepferMS404, AkaiMPC60, AkaiXR10, AkaiLinn, AlesisHR16, AlesisSR16, BossDR110, BossDR220, BossDR55, BossDR550, BossDR660, CasioRZ1, CasioSK1, CasioVL1, KorgDDM110, KorgKPR77, KorgKR55, KorgKRZ, KorgM1, KorgMinipops, KorgPoly800, KorgT3, MFB512, MPC1000, MoogConcertMateMG1, RhythmAce, RhodesPolaris, SakataDPM48, SequentialCircuitsDrumtracks, SequentialCircuitsTom, SoundmastersR88, UnivoxMicroRhythmer12, ViscoSpaceDrum, XdrumLM8953, YamahaRM50, YamahaRX21, YamahaRX5, YamahaRY30, YamahaTG33, AJKPercusyn

## Complete Example

```js
samples('github:tidalcycles/dirt-samples')
setcps(128/60/4)

// Drums
$: s("bd ~ [~ bd] ~, ~ cp ~ ~, hh*8")
  .bank("RolandTR909")
  .gain(".8 .8 .8 .8, .6, .3")
  .sometimes(x => x.speed("1.5"))

// Bass
$: note("<c2 [c2 c2] ab1 [bb1 bb1]>")
  .sound("sawtooth")
  .lpf(sine.range(200, 800).slow(8))
  .decay(.2).sustain(.4)

// Chords
$: note("<[c3,eb3,g3] [ab2,c3,eb3] [eb3,g3,bb3] [bb2,d3,f3]>")
  .sound("supersaw").lpf(1200)
  .room(.4).delay(.3).delaytime(.375).gain(.15)

// Melody
$: n("0 2 [4 5] 7 [9 7] 5 4 2")
  .scale("C:minor").sound("sine")
  .fm(2).fmdecay(.1)
  .every(4, rev)
  .delay(.5).delaytime(.25).delayfeedback(.4).gain(.25)
```
