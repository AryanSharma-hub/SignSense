import { Icon } from './ui.jsx';
import { SPEEDS } from '../hooks/useStagePlayer.js';

const IconBtn = ({ icon, label, onClick, disabled, size = 16, primary = false }) => (
  <button
    type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors disabled:opacity-35
      ${primary ? 'border-transparent bg-hand text-on-accent hover:bg-hand/85' : 'border-line bg-surface hover:bg-surface2'}`}
  ><Icon name={icon} size={size} /></button>
);

/**
 * Transport for the stage: play your sign, then pause / step / scrub / change speed /
 * replay. Speed changes only how fast the timeline is walked, never the sequence.
 */
export function PlaybackBar({ player, canAct, onAct }) {
  const { performing, paused, frames = [], index } = player;
  const firstOfWord = (w) => frames.findIndex((f) => f.word === w);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Playback">
      {performing ? (
        <>
          <IconBtn icon="skipBack" label="Previous word" onClick={() => player.jumpToWord(Math.max(0, player.word - (index > firstOfWord(player.word) ? 0 : 1)))} />
          <IconBtn icon="left" label="Previous step" onClick={player.prev} disabled={index <= 0} />
          {paused
            ? <IconBtn icon="play" label="Resume" onClick={player.resume} primary />
            : <IconBtn icon="pause" label="Pause" onClick={player.pause} primary />}
          <IconBtn icon="right" label="Next step" onClick={player.next} disabled={index >= frames.length - 1} />
          <IconBtn icon="skipFwd" label="Next word" onClick={() => player.jumpToWord(player.word + 1)} disabled={player.word >= player.count - 1} />
          <IconBtn icon="replay" label="Restart from the beginning" onClick={player.restart} />
          <IconBtn icon="stop" label="Stop" onClick={player.cancel} size={13} />
          <label className="flex min-w-[120px] flex-1 items-center gap-2">
            <span className="sr-only">Timeline position</span>
            <input
              type="range" min={0} max={Math.max(0, frames.length - 1)} step={1} value={Math.max(0, index)}
              onChange={(e) => { if (!paused) player.pause(); player.seek(Number(e.target.value)); }}
              className="scrubber w-full" aria-valuetext={`Step ${index + 1} of ${frames.length}`}
            />
            <span className="shrink-0 font-mono text-[12px] text-muted">{index + 1}/{frames.length}</span>
          </label>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-primary !min-h-[38px] !px-3 text-[14px]" disabled={!canAct} onClick={onAct}><Icon name="play" size={14} /> Act out your sign</button>
          <button type="button" className="btn !min-h-[38px] !px-3 text-[14px]" disabled={!player.last} onClick={player.replay}><Icon name="replay" size={15} /> Replay last</button>
          <span className="flex-1" />
        </>
      )}
      <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted" title="Playback speed. Below 1× is slow practice: same signs, more time.">
        <Icon name="clock" size={15} />
        <span className="sr-only">Playback speed</span>
        <select
          value={player.speed} onChange={(e) => player.setSpeed(Number(e.target.value))}
          className="min-h-[34px] rounded-lg border border-line bg-surface px-1.5 text-[13px] font-semibold text-ink"
        >
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
    </div>
  );
}
