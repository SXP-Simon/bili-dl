Synthetic, one-second fixtures generated with FFmpeg (no third-party media).
These are fragmented MP4 inputs like DASH tracks. Tests use the installed MP4Box
library directly and do not require FFmpeg at runtime.

Regenerate from the repository root:

ffmpeg -f lavfi -i testsrc2=size=160x90:rate=25 -t 1 -c:v libx264 -an -movflags +frag_keyframe+empty_moov+default_base_moof tests/fixtures/media/video.mp4
ffmpeg -f lavfi -i sine=frequency=440:sample_rate=48000 -t 1 -c:a aac -vn -movflags +frag_keyframe+empty_moov+default_base_moof tests/fixtures/media/audio.mp4

Additional codec fixtures:

ffmpeg -f lavfi -i testsrc2=size=160x90:rate=25 -t 1 -c:v libx265 -x265-params log-level=error:pools=1 -tag:v hvc1 -an -movflags +frag_keyframe+empty_moov+default_base_moof tests/fixtures/media/video-hevc.mp4
ffmpeg -f lavfi -i testsrc2=size=160x90:rate=25 -t 1 -c:v libaom-av1 -cpu-used 8 -crf 45 -an -movflags +frag_keyframe+empty_moov+default_base_moof tests/fixtures/media/video-av1.mp4
