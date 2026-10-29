import { describe, expect, it } from 'vitest';
import { isSquat, mergeLabels, parseLabels, splitCsvLine, videoKey } from './labels.js';

describe('label files', () => {
  it('reads the RepCount annotation format', () => {
    const csv = [
      ',type,name,count,L1,L2,L3,L4',
      '0,squat,stu1_10.mp4,2,12,40,41,70',
      '1,pull_up,train951.mp4,8,3,20,,',
      '2,squat,"test, 7.mp4",0,,,,',
    ].join('\r\n');
    const labels = parseLabels(csv);
    expect(labels.types).toEqual(['pull_up', 'squat']);
    expect(labels.byVideo.get('stu1_10')).toEqual({ count: 2, type: 'squat' });
    expect(labels.byVideo.get('test, 7')).toEqual({ count: 0, type: 'squat' });
  });

  it('reads the simple format, including a CSV exported by this page', () => {
    const labels = parseLabels(
      '\uFEFFvideo,model,ground_truth_reps\nSquat 01.MP4,lite,12\nb.webm,lite,\n',
    );
    expect(labels.byVideo.get('squat 01')).toEqual({ count: 12, type: null });
    expect(labels.byVideo.has('b')).toBe(false);
    expect(labels.types).toEqual([]);
  });

  it('rejects files without the needed columns', () => {
    expect(() => parseLabels('a,b\n1,2')).toThrow('cột');
  });

  it('matches files by name without folder or extension', () => {
    expect(videoKey('RepCount/video/test/Squat_01.MP4')).toBe('squat_01');
    expect(videoKey('C:\\data\\a.b.mp4')).toBe('a.b');
    expect(splitCsvLine('"a ""x"", b",2')).toEqual(['a "x", b', '2']);
  });

  it('reads JSON Lines labels and recognises squat spelling variants', () => {
    const jsonl = [
      '{"video": "stu8_42.mp4", "count": 6, "action_type": "push_up", "raw_source": "EveryShotCounts"}',
      '{"video": "train951.mp4", "count": 9, "action_type": "squant"}',
      '{"video": "test12.mp4", "count": 11, "action_type": "squat"}',
    ].join('\n');
    const labels = parseLabels(jsonl);
    expect(labels.byVideo.get('test12')).toEqual({ count: 11, type: 'squat' });
    const squats = [...labels.byVideo].filter(([, l]) => isSquat(l.type)).map(([k]) => k);
    expect(squats).toEqual(['train951', 'test12']);
    expect(isSquat('push_up')).toBe(false);
    expect(isSquat(null)).toBe(false);
  });

  it('merges train/valid/test label files', () => {
    const a = parseLabels('type,name,count\nsquat,a.mp4,3');
    const b = parseLabels('type,name,count\nfront_raise,b.mp4,5');
    const all = mergeLabels([a, b]);
    expect(all.byVideo.size).toBe(2);
    expect(all.types).toEqual(['front_raise', 'squat']);
  });
});
