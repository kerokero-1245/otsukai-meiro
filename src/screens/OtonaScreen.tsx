// おとなモード（親ゲート＝⚙️3秒長押しの奥）。
// フェーズ2で「この子だけの世界地図」を作る場所になった（DESIGN §1 / §7 / §9）:
//   ・ゴールのしゃしん … おばあちゃんの家・この前いった公園などを最大6枚。ゴールに混ざって出る。
//   ・こえ            … 「ついたね!」「ぜんぶ できたね!」をおじの声で録る。ずんだもんの代わりに鳴る。
// あわせて ⭐リセット（§14）・BGM トグルもここに置く。
//
// 絶対条件（プライバシー）:
//   ・写真も録音も **この端末の中（IndexedDB）にだけ** 保存する。外部送信・アカウント・通信はゼロ。
//   ・いつでも消せる（1枚ずつ／ぜんぶ／録音も）。破壊的な操作には確認を1枚はさむ（§6）。
//   ・保存が使えない環境（プライベートブラウズ等）ではクラッシュさせず、機能を「つかえません」と示す。
//
// こども側の UI には何も足さない（§4）。ここは普通のアプリUIでよい。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';
import BigButton from '../components/BigButton';
import { clearedCount, resetProgress } from '../progress';
import { isBgmOn, setBgmOn } from '../audio/bgm';
import { sayPhrase, warmUpVoice, cancelVoice } from '../audio/voice';
import {
  MAX_PHOTOS,
  PhotoItem,
  VOICE_SLOTS,
  VoiceSlot,
  addPhotoFiles,
  clearAllPhotos,
  initPersonal,
  isPersonalAvailable,
  isPersonalReady,
  listPhotos,
  removePhoto,
  removeVoice,
  saveVoice,
  subscribePersonal,
  voiceUrl,
} from '../personal/store';
import { canPickPhotos, pickPhotoFiles } from '../personal/filePicker';
import { ActiveRecording, MAX_MS, canRecord, startRecording } from '../personal/recorder';

interface Props {
  onBack: () => void;
}

// 録音スロットの見出し（子どもに聞こえるフレーズそのもの）。
const SLOT_LABEL: Record<VoiceSlot, string> = {
  tsuita: 'ついたね!',
  zenbu: 'ぜんぶ できたね!',
};
const SLOT_WHEN: Record<VoiceSlot, string> = {
  tsuita: 'ゴールに ついたとき',
  zenbu: 'ぜんぶ ⭐が そろったとき',
};

export default function OtonaScreen({ onBack }: Props) {
  const [count, setCount] = useState(() => clearedCount());
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [bgmOn, setBgmOnState] = useState(() => isBgmOn());

  // 在庫（写真・録音）の変化を拾って描き直すためのカウンタ。
  const [, bump] = useState(0);
  const rerender = useCallback(() => bump((n) => n + 1), []);

  const [storageReady, setStorageReady] = useState(() => isPersonalReady());
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [confirmClearPhotos, setConfirmClearPhotos] = useState(false);

  // 録音の状態: null=なにもしていない / 'preparing'=マイクを開いている最中 / 'recording'=録音中。
  // getUserMedia は端末によっては1秒以上かかる。準備中に「とめて ほぞん」を押せてしまうと
  // 何も保存されない（＝押したのに無反応）ので、準備が終わるまで停止ボタンは出さない。
  const [recordingSlot, setRecordingSlot] = useState<VoiceSlot | null>(null);
  const [recPhase, setRecPhase] = useState<'preparing' | 'recording'>('preparing');
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [voiceToDelete, setVoiceToDelete] = useState<VoiceSlot | null>(null);
  const recRef = useRef<ActiveRecording | null>(null);

  // 在庫の初期化＋購読。画面を出入りしても在庫はモジュール側に残る。
  useEffect(() => {
    let alive = true;
    const unsub = subscribePersonal(rerender);
    void initPersonal().then(() => {
      if (alive) {
        setStorageReady(true);
        rerender();
      }
    });
    return () => {
      alive = false;
      unsub();
      // 画面を離れるときは録音を捨て、マイクを解放する（撮りっぱなしを残さない）。
      if (recRef.current) {
        recRef.current.cancel();
        recRef.current = null;
      }
      cancelVoice();
    };
  }, [rerender]);

  const storageOk = isPersonalAvailable();
  const photos: PhotoItem[] = listPhotos();

  // BGM の ON/OFF トグル（既定 ON・保存キー meiro.bgm）。この押下はユーザー操作なので、
  // ON にした瞬間その場で（ジェスチャ文脈で）鳴らし直せる。OFF なら即フェード停止。
  const toggleBgm = () => {
    const next = !bgmOn;
    setBgmOn(next);
    setBgmOnState(next);
  };

  const doReset = () => {
    resetProgress();
    setCount(0);
    setConfirming(false);
    setDone(true);
  };

  // ── しゃしん ─────────────────────────────────────────────────────
  const onAddPhotos = () => {
    setPhotoMsg(null);
    const opened = pickPhotoFiles((files) => {
      setBusy(true);
      setPhotoMsg('よみこみちゅう…');
      void addPhotoFiles(files)
        .then((r) => {
          if (r.added > 0 && !r.full && r.failed === 0) {
            setPhotoMsg(`${r.added}まい ふやしました。`);
          } else if (r.full) {
            setPhotoMsg(`しゃしんは ${MAX_PHOTOS}まいまでです。`);
          } else if (r.failed > 0 && r.added === 0) {
            setPhotoMsg('この しゃしんは つかえませんでした。');
          } else {
            setPhotoMsg(`${r.added}まい ふやしました。`);
          }
        })
        .catch(() => setPhotoMsg('ふやせませんでした。'))
        .finally(() => setBusy(false));
    });
    if (!opened) setPhotoMsg('この ブラウザでは しゃしんを えらべません。');
  };

  const doRemovePhoto = (id: string) => {
    setPhotoToDelete(null);
    setPhotoMsg(null);
    void removePhoto(id).then(() => setPhotoMsg('1まい けしました。'));
  };

  const doClearPhotos = () => {
    setConfirmClearPhotos(false);
    setPhotoMsg(null);
    void clearAllPhotos().then(() => setPhotoMsg('しゃしんを ぜんぶ けしました。'));
  };

  // ── こえ ─────────────────────────────────────────────────────────
  // 停止して保存（「とめて ほぞん」ボタン／上限での自動停止のどちらからも通る）。
  const finishRecording = useCallback(async (slot: VoiceSlot) => {
    const rec = recRef.current;
    if (!rec) {
      setRecordingSlot(null);
      return;
    }
    recRef.current = null;
    const out = await rec.stop();
    setRecordingSlot(null);
    if (!out) {
      setVoiceMsg('ろくおんできませんでした。');
      return;
    }
    const ok = await saveVoice(slot, out.blob, out.mime);
    setVoiceMsg(ok ? 'ろくおんしました。' : 'ほぞんできませんでした。');
  }, []);

  const onStartRecording = (slot: VoiceSlot) => {
    if (recordingSlot) return;
    setVoiceMsg(null);
    setRecordingSlot(slot);
    setRecPhase('preparing');
    void startRecording(() => {
      // 上限（MAX_MS）で自動停止したときも、押されたのと同じように保存へ回す。
      void finishRecording(slot);
    })
      .then((rec) => {
        if (!rec) {
          setRecordingSlot(null);
          setVoiceMsg('マイクを つかえませんでした（きょかを かくにんしてください）。');
          return;
        }
        recRef.current = rec;
        setRecPhase('recording'); // ここで初めて「とめて ほぞん」を出す
      })
      .catch(() => {
        setRecordingSlot(null);
        setVoiceMsg('マイクを つかえませんでした。');
      });
  };

  const onTestVoice = (slot: VoiceSlot) => {
    warmUpVoice(); // このタップを起点に声エンジンを解禁（iOS Safari 対策）
    sayPhrase(slot);
  };

  const doRemoveVoice = (slot: VoiceSlot) => {
    setVoiceToDelete(null);
    void removeVoice(slot).then(() => setVoiceMsg('けしました（ずんだもんの こえに もどります）。'));
  };

  const canUsePhotos = storageOk && canPickPhotos();
  const canUseVoice = storageOk && canRecord();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>おとなモード</Text>

      {/* プライバシーの約束（この画面の一番上に置く） */}
      <View style={styles.card}>
        <Text style={styles.body}>
          しゃしんと こえは この たんまつの 中にだけ ほぞんされます。
        </Text>
        <Text style={styles.note}>
          どこにも おくりません（つうしん・アカウント・クラウドは つかいません）。いつでも けせます。
        </Text>
      </View>

      {/* ── ゴールのしゃしん ───────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>ゴールの しゃしん</Text>
        <Text style={styles.note}>
          おばあちゃんの家、この前いった公園など。いれると、めいろの ゴールに でてきます
          （でない回は これまでどおりの え）。さいだい {MAX_PHOTOS}まい。
        </Text>

        {!storageReady ? (
          <Text style={styles.note}>よみこみちゅう…</Text>
        ) : !canUsePhotos ? (
          <Text style={styles.warn}>
            この ブラウザでは しゃしんを ほぞんできません（プライベートブラウズなど）。
            めいろは これまでどおり あそべます。
          </Text>
        ) : (
          <>
            {photos.length > 0 ? (
              <View style={styles.thumbRow}>
                {photos.map((p, i) => (
                  <View key={p.id} style={styles.thumbWrap}>
                    <Image source={{ uri: p.url }} style={styles.thumb} resizeMode="cover" />
                    <Pressable
                      onPress={() => setPhotoToDelete(p.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`しゃしん${i + 1}を けす`}
                      style={styles.thumbX}
                    >
                      <Text style={styles.thumbXGlyph}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.note}>まだ ありません。</Text>
            )}

            {photoToDelete ? (
              <View style={styles.confirmRow}>
                <Text style={styles.confirmText}>この しゃしんを けしますか?</Text>
                <View style={styles.confirmButtons}>
                  <BigButton size="small"
                    emoji="🗑️"
                    label="けす"
                    onPress={() => doRemovePhoto(photoToDelete)}
                    color={colors.button}
                  />
                  <BigButton size="small" emoji="↩️" label="やめる" onPress={() => setPhotoToDelete(null)} />
                </View>
              </View>
            ) : confirmClearPhotos ? (
              <View style={styles.confirmRow}>
                <Text style={styles.confirmText}>しゃしんを ぜんぶ けしますか?</Text>
                <View style={styles.confirmButtons}>
                  <BigButton size="small"
                    emoji="🗑️"
                    label="ぜんぶ けす"
                    onPress={doClearPhotos}
                    color={colors.button}
                  />
                  <BigButton size="small"
                    emoji="↩️"
                    label="やめる"
                    onPress={() => setConfirmClearPhotos(false)}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.actionCol}>
                <BigButton size="small"
                  emoji="🖼️"
                  label={busy ? 'よみこみちゅう…' : 'しゃしんを ふやす'}
                  onPress={busy || photos.length >= MAX_PHOTOS ? () => {} : onAddPhotos}
                  color={photos.length >= MAX_PHOTOS ? undefined : colors.play}
                  pressedColor={photos.length >= MAX_PHOTOS ? undefined : colors.playPressed}
                />
                {photos.length > 0 ? (
                  <BigButton size="small"
                    emoji="🗑️"
                    label="しゃしんを ぜんぶ けす"
                    onPress={() => setConfirmClearPhotos(true)}
                  />
                ) : null}
              </View>
            )}

            {photos.length >= MAX_PHOTOS ? (
              <Text style={styles.note}>いっぱいです（{MAX_PHOTOS}まい）。</Text>
            ) : null}
            {photoMsg ? <Text style={styles.note}>{photoMsg}</Text> : null}
          </>
        )}
      </View>

      {/* ── おじの こえ ────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>こえ</Text>
        <Text style={styles.note}>
          ろくおんすると、その ばめんで おじの こえが ながれます（ろくおんが なければ
          ずんだもんの こえ）。ながさは {Math.round(MAX_MS / 1000)}びょうまで。
        </Text>

        {!storageReady ? (
          <Text style={styles.note}>よみこみちゅう…</Text>
        ) : !canUseVoice ? (
          <Text style={styles.warn}>
            この ブラウザでは ろくおんできません。めいろは これまでどおり あそべます。
          </Text>
        ) : (
          <>
            {VOICE_SLOTS.map((slot) => {
              const has = voiceUrl(slot) != null;
              const recording = recordingSlot === slot;
              return (
                <View key={slot} style={styles.slot}>
                  <Text style={styles.slotTitle}>「{SLOT_LABEL[slot]}」</Text>
                  <Text style={styles.note}>{SLOT_WHEN[slot]}</Text>
                  <Text style={styles.note}>
                    いま: {has ? 'おじの こえ' : 'ずんだもんの こえ（きほん）'}
                  </Text>

                  {voiceToDelete === slot ? (
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmText}>この ろくおんを けしますか?</Text>
                      <View style={styles.confirmButtons}>
                        <BigButton size="small"
                          emoji="🗑️"
                          label="けす"
                          onPress={() => doRemoveVoice(slot)}
                          color={colors.button}
                        />
                        <BigButton size="small"
                          emoji="↩️"
                          label="やめる"
                          onPress={() => setVoiceToDelete(null)}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.actionCol}>
                      {recording && recPhase === 'recording' ? (
                        <BigButton size="small"
                          emoji="⏹️"
                          label="とめて ほぞん"
                          onPress={() => void finishRecording(slot)}
                          color={colors.button}
                        />
                      ) : recording ? (
                        <BigButton size="small" emoji="⌛" label="マイクを ひらいています…" onPress={() => {}} />
                      ) : (
                        <BigButton size="small"
                          emoji="🎙️"
                          label={has ? 'とりなおす' : 'ろくおん'}
                          onPress={
                            recordingSlot ? () => {} : () => onStartRecording(slot)
                          }
                          color={colors.play}
                          pressedColor={colors.playPressed}
                        />
                      )}
                      <BigButton size="small"
                        emoji="▶️"
                        label="ためしぎき"
                        onPress={() => onTestVoice(slot)}
                      />
                      {has ? (
                        <BigButton size="small"
                          emoji="🗑️"
                          label="ろくおんを けす"
                          onPress={() => setVoiceToDelete(slot)}
                        />
                      ) : null}
                    </View>
                  )}

                  {recording ? (
                    <Text style={styles.recording}>
                      {recPhase === 'recording' ? '● ろくおんちゅう…' : '⌛ じゅんびちゅう…'}
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {voiceMsg ? <Text style={styles.note}>{voiceMsg}</Text> : null}
          </>
        )}
      </View>

      {/* ごほうび（⭐）のリセット。子どもの誤操作で消えないよう確認を1枚はさむ。 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>ごほうびの ⭐</Text>
        <Text style={styles.note}>
          {done ? 'リセットしました。' : `いま ⭐は ${count} こ ついています。`}
        </Text>

        {confirming ? (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>ぜんぶ けしても いい?</Text>
            <View style={styles.confirmButtons}>
              <BigButton emoji="🗑️" label="けす" onPress={doReset} color={colors.button} />
              <BigButton emoji="↩️" label="やめる" onPress={() => setConfirming(false)} />
            </View>
          </View>
        ) : (
          <View style={styles.resetWrap}>
            <BigButton
              emoji="⭐"
              label="⭐をリセット"
              onPress={() => {
                setDone(false);
                setConfirming(true);
              }}
            />
          </View>
        )}
      </View>

      {/* BGM（オルゴール）の ON/OFF。既定 ON。子は触らない前提（親ゲートの奥）だが、うるさければ切れる。 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>おんがく（BGM）</Text>
        <Text style={styles.note}>
          {bgmOn ? 'いま BGM は ながれます ♪' : 'いま BGM は ながれません。'}
        </Text>
        <View style={styles.resetWrap}>
          <BigButton
            emoji={bgmOn ? '🎵' : '🔇'}
            label={bgmOn ? 'BGM: ながす' : 'BGM: ながさない'}
            onPress={toggleBgm}
            color={bgmOn ? colors.play : colors.button}
            pressedColor={bgmOn ? colors.playPressed : colors.buttonPressed}
          />
        </View>
        <Text style={styles.note}>タップで きりかえ</Text>
      </View>

      {/* こえ（よみあげ）の出どころ。同梱クリップは VOICEVOX（ずんだもん）で生成。
          対応環境が無い場合のみ端末の音声合成へフォールバックする（README の音声メモ参照）。 */}
      <Text style={styles.credit}>VOICEVOX:ずんだもん</Text>

      <BigButton emoji="◀️" label="もどる" onPress={onBack} color={colors.button} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.tileBorder,
    marginBottom: space.md,
  },
  body: {
    fontSize: font.body,
    color: colors.text,
    lineHeight: 30,
  },
  sectionTitle: {
    fontSize: font.big,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.xs,
  },
  note: {
    fontSize: font.small,
    color: colors.subtext,
    marginTop: space.xs,
    lineHeight: 24,
  },
  warn: {
    fontSize: font.small,
    color: colors.text,
    marginTop: space.sm,
    lineHeight: 24,
  },
  // 写真のサムネイル一覧
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: space.sm,
  },
  thumbWrap: {
    width: 76,
    height: 76,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: radius.sm,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.tileDark,
  },
  thumbX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbXGlyph: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.white,
  },
  actionCol: {
    marginTop: space.md,
    rowGap: space.sm,
  },
  slot: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.tileBorder,
  },
  slotTitle: {
    fontSize: font.body,
    fontWeight: '800',
    color: colors.text,
  },
  recording: {
    marginTop: space.sm,
    fontSize: font.body,
    fontWeight: '800',
    color: '#D9534F',
  },
  resetWrap: {
    marginTop: space.md,
  },
  confirmRow: {
    marginTop: space.md,
  },
  confirmText: {
    fontSize: font.body,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.sm,
  },
  confirmButtons: {
    rowGap: space.sm,
  },
  credit: {
    fontSize: font.small,
    color: colors.subtext,
    textAlign: 'center',
    marginBottom: space.md,
    marginTop: space.md,
  },
});
