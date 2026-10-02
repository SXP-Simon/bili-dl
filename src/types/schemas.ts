import { z } from 'zod';

// ============================
// 1. 分 P 列表接口 (pagelist)
// ============================
export const BiliVideoPageItemSchema = z
  .object({
    cid: z.number(),
    page: z.number(),
    part: z.string().nullish().default(''),
    duration: z.number().nullish().default(0),
  })
  ;

export const BiliPageListResponseSchema = z
  .object({
    code: z.number().nullish(),
    message: z.string().nullish(),
    data: z.array(BiliVideoPageItemSchema).nullish(),
  })
  ;

// ============================
// 2. AI 视频总结接口 (conclusion)
// ============================
export const BiliAiSummaryOutlinePartSchema = z
  .object({
    content: z.string().nullish(),
  })
  ;

export const BiliAiSummaryOutlineItemSchema = z
  .object({
    title: z.string().nullish().default(''),
    timestamp: z.number().nullish().default(0),
    part_outline: z.array(BiliAiSummaryOutlinePartSchema).nullish(),
  })
  ;

export const BiliAiSummaryModelResultSchema = z
  .object({
    summary: z.string().nullish(),
    outline: z.array(BiliAiSummaryOutlineItemSchema).nullish(),
  })
  ;

export const BiliAiSummaryResponseSchema = z
  .object({
    code: z.number().nullish(),
    data: z
      .object({
        model_result: BiliAiSummaryModelResultSchema.nullish(),
      })
      .nullish(),
  })
  ;

// ============================
// 3. 合集/系列接口 (seasons_archives_list)
// ============================
export const BiliSeasonArchiveItemSchema = z
  .object({
    aid: z.number().nullish(),
    bvid: z.string(),
    cid: z.number().nullish(),
    title: z.string().nullish().default(''),
    pic: z.string().nullish(),
    duration: z.number().nullish(),
  })
  ;

export const BiliSeasonMetaSchema = z
  .object({
    name: z.string().nullish(),
    cover: z.string().nullish(),
    total: z.number().nullish(),
  })
  ;

export const BiliSeasonArchivesResponseSchema = z
  .object({
    code: z.number().nullish(),
    data: z
      .object({
        archives: z.array(BiliSeasonArchiveItemSchema).nullish(),
        meta: BiliSeasonMetaSchema.nullish(),
      })
      .nullish(),
  })
  ;

// ============================
// 4. 播放流地址 (playurl DASH)
// ============================
export const BiliDashVideoItemSchema = z
  .object({
    id: z.union([z.number(), z.string().transform(Number)]),
    codecs: z.string().nullish().default(''),
    bandwidth: z.number().nullish().default(0),
    baseUrl: z.string().nullish(),
    base_url: z.string().nullish(),
    backupUrl: z.array(z.string()).nullish(),
    backup_url: z.array(z.string()).nullish(),
    width: z.number().nullish().default(0),
    height: z.number().nullish().default(0),
    frameRate: z.union([z.string(), z.number()]).nullish(),
    frame_rate: z.union([z.string(), z.number()]).nullish(),
  })
  ;

export const BiliDashAudioItemSchema = z
  .object({
    id: z.union([z.number(), z.string().transform(Number)]),
    codecs: z.string().nullish(),
    bandwidth: z.number().nullish().default(0),
    baseUrl: z.string().nullish(),
    base_url: z.string().nullish(),
    backupUrl: z.array(z.string()).nullish(),
    backup_url: z.array(z.string()).nullish(),
  })
  ;

export const BiliDashDataSchema = z
  .object({
    duration: z.union([z.number(), z.string().transform(Number)]).nullish(),
    video: z.array(BiliDashVideoItemSchema).nullish(),
    audio: z.array(BiliDashAudioItemSchema).nullish(),
    dolby: z
      .object({
        audio: z.array(BiliDashAudioItemSchema).nullish(),
      })
      .nullish(),
    flac: z
      .object({
        audio: BiliDashAudioItemSchema.nullish(),
      })
      .nullish(),
  })
  ;

export const BiliPlayUrlDataSchema = z
  .object({
    duration: z.union([z.number(), z.string().transform(Number)]).nullish(),
    dash: BiliDashDataSchema.nullish(),
  })
  ;

export const BiliPlayUrlResponseSchema = z
  .object({
    code: z.number().nullish(),
    data: BiliPlayUrlDataSchema.nullish(),
    result: BiliPlayUrlDataSchema.nullish(),
  })
  ;

// ============================
// 5. 播放器字幕接口 (player/wbi/v2 & player/v2)
// ============================
export const BiliSubtitleItemSchema = z
  .object({
    id: z.union([z.number(), z.string()]).nullish(),
    id_str: z.string().nullish(),
    lan: z.string().nullish(),
    lang: z.string().nullish(),
    lan_doc: z.string().nullish(),
    lang_doc: z.string().nullish(),
    subtitle_url: z.string().nullish(),
    url: z.string().nullish(),
  })
  ;

export const BiliPlayerSubtitleDataSchema = z
  .object({
    subtitle: z
      .object({
        subtitles: z.array(BiliSubtitleItemSchema).nullish(),
        list: z.array(BiliSubtitleItemSchema).nullish(),
      })
      .nullish(),
  })
  ;

export const BiliPlayerResponseSchema = z
  .object({
    code: z.number().nullish(),
    data: BiliPlayerSubtitleDataSchema.nullish(),
  })
  ;

// ============================
// 6. 字幕文件内容 (JSON body)
// ============================
export const BiliSubtitleBodyItemSchema = z
  .object({
    from: z.union([z.number(), z.string()]).nullish().default(0),
    to: z.union([z.number(), z.string()]).nullish().default(0),
    location: z.number().nullish(),
    content: z.string().nullish(),
    text: z.string().nullish(),
    words: z.string().nullish(),
  })
  ;

export const BiliSubtitleFileSchema = z.union([
  z.array(BiliSubtitleBodyItemSchema),
  z
    .object({
      body: z.array(BiliSubtitleBodyItemSchema).nullish(),
      list: z.array(BiliSubtitleBodyItemSchema).nullish(),
      lines: z.array(BiliSubtitleBodyItemSchema).nullish(),
    }),
]);

// ============================
// 7. WBI 密钥接口 (nav)
// ============================
export const BiliNavResponseSchema = z
  .object({
    code: z.number().nullish(),
    data: z
      .object({
        wbi_img: z
          .object({
            img_url: z.string().nullish(),
            sub_url: z.string().nullish(),
          })
          .nullish(),
      })
      .nullish(),
  })
  ;

export type BiliVideoPageItem = z.infer<typeof BiliVideoPageItemSchema>;
export type BiliDashVideoItem = z.infer<typeof BiliDashVideoItemSchema>;
export type BiliDashAudioItem = z.infer<typeof BiliDashAudioItemSchema>;
export type BiliDashData = z.infer<typeof BiliDashDataSchema>;
export type BiliSubtitleBodyItem = z.infer<typeof BiliSubtitleBodyItemSchema>;
export type BiliSubtitleItem = z.infer<typeof BiliSubtitleItemSchema>;
