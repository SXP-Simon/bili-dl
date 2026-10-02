import { z } from 'zod';

// ============================
// 1. 分 P 列表接口 (pagelist)
// ============================
export const BiliVideoPageItemSchema = z.object({
  cid: z.number(),
  page: z.number(),
  part: z.string().default(''),
  duration: z.number().default(0),
});

export const BiliPageListResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: z.array(BiliVideoPageItemSchema).optional(),
});

// ============================
// 2. AI 视频总结接口 (conclusion)
// ============================
export const BiliAiSummaryOutlinePartSchema = z.object({
  content: z.string().optional(),
});

export const BiliAiSummaryOutlineItemSchema = z.object({
  title: z.string().default(''),
  timestamp: z.number().default(0),
  part_outline: z.array(BiliAiSummaryOutlinePartSchema).optional(),
});

export const BiliAiSummaryModelResultSchema = z.object({
  summary: z.string().optional(),
  outline: z.array(BiliAiSummaryOutlineItemSchema).optional(),
});

export const BiliAiSummaryResponseSchema = z.object({
  code: z.number(),
  data: z
    .object({
      model_result: BiliAiSummaryModelResultSchema.optional(),
    })
    .optional(),
});

// ============================
// 3. 合集/系列接口 (seasons_archives_list)
// ============================
export const BiliSeasonArchiveItemSchema = z.object({
  aid: z.number().optional(),
  bvid: z.string(),
  cid: z.number().optional(),
  title: z.string().default(''),
  pic: z.string().optional(),
  duration: z.number().optional(),
});

export const BiliSeasonMetaSchema = z.object({
  name: z.string().optional(),
  cover: z.string().optional(),
  total: z.number().optional(),
});

export const BiliSeasonArchivesResponseSchema = z.object({
  code: z.number(),
  data: z
    .object({
      archives: z.array(BiliSeasonArchiveItemSchema).optional(),
      meta: BiliSeasonMetaSchema.optional(),
    })
    .optional(),
});

// ============================
// 4. 播放流地址 (playurl DASH)
// ============================
export const BiliDashVideoItemSchema = z.object({
  id: z.number(),
  codecs: z.string().default(''),
  bandwidth: z.number().default(0),
  baseUrl: z.string().optional(),
  base_url: z.string().optional(),
  backupUrl: z.array(z.string()).optional(),
  backup_url: z.array(z.string()).optional(),
  width: z.number().default(0),
  height: z.number().default(0),
  frameRate: z.string().optional(),
  frame_rate: z.string().optional(),
});

export const BiliDashAudioItemSchema = z.object({
  id: z.number(),
  codecs: z.string().optional(),
  bandwidth: z.number().default(0),
  baseUrl: z.string().optional(),
  base_url: z.string().optional(),
  backupUrl: z.array(z.string()).optional(),
  backup_url: z.array(z.string()).optional(),
});

export const BiliDashDataSchema = z.object({
  duration: z.number().optional(),
  video: z.array(BiliDashVideoItemSchema).optional(),
  audio: z.array(BiliDashAudioItemSchema).optional(),
  dolby: z
    .object({
      audio: z.array(BiliDashAudioItemSchema).optional(),
    })
    .optional(),
  flac: z
    .object({
      audio: BiliDashAudioItemSchema.optional(),
    })
    .optional(),
});

export const BiliPlayUrlDataSchema = z.object({
  duration: z.number().optional(),
  dash: BiliDashDataSchema.optional(),
});

export const BiliPlayUrlResponseSchema = z.object({
  code: z.number().optional(),
  data: BiliPlayUrlDataSchema.optional(),
  result: BiliPlayUrlDataSchema.optional(),
});

// ============================
// 5. 播放器字幕接口 (player/wbi/v2 & player/v2)
// ============================
export const BiliSubtitleItemSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  id_str: z.string().optional(),
  lan: z.string().optional(),
  lang: z.string().optional(),
  lan_doc: z.string().optional(),
  lang_doc: z.string().optional(),
  subtitle_url: z.string().optional(),
  url: z.string().optional(),
});

export const BiliPlayerSubtitleDataSchema = z.object({
  subtitle: z
    .object({
      subtitles: z.array(BiliSubtitleItemSchema).optional(),
      list: z.array(BiliSubtitleItemSchema).optional(),
    })
    .optional(),
});

export const BiliPlayerResponseSchema = z.object({
  code: z.number().optional(),
  data: BiliPlayerSubtitleDataSchema.optional(),
});

// ============================
// 6. 字幕文件内容 (JSON body)
// ============================
export const BiliSubtitleBodyItemSchema = z.object({
  from: z.union([z.number(), z.string()]).default(0),
  to: z.union([z.number(), z.string()]).default(0),
  location: z.number().optional(),
  content: z.string().optional(),
  text: z.string().optional(),
  words: z.string().optional(),
});

export const BiliSubtitleFileSchema = z.union([
  z.array(BiliSubtitleBodyItemSchema),
  z.object({
    body: z.array(BiliSubtitleBodyItemSchema).optional(),
    list: z.array(BiliSubtitleBodyItemSchema).optional(),
    lines: z.array(BiliSubtitleBodyItemSchema).optional(),
  }),
]);

// ============================
// 7. WBI 密钥接口 (nav)
// ============================
export const BiliNavResponseSchema = z.object({
  code: z.number().optional(),
  data: z
    .object({
      wbi_img: z
        .object({
          img_url: z.string().optional(),
          sub_url: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type BiliVideoPageItem = z.infer<typeof BiliVideoPageItemSchema>;
export type BiliDashVideoItem = z.infer<typeof BiliDashVideoItemSchema>;
export type BiliDashAudioItem = z.infer<typeof BiliDashAudioItemSchema>;
export type BiliDashData = z.infer<typeof BiliDashDataSchema>;
export type BiliSubtitleBodyItem = z.infer<typeof BiliSubtitleBodyItemSchema>;
export type BiliSubtitleItem = z.infer<typeof BiliSubtitleItemSchema>;
