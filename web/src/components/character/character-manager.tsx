'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from '@/components/ui/primitives';
import {
  ACTION_SUGGESTIONS,
  DIALOGUE_POSES,
  frameSize,
  spriteFrame,
} from '@/game/character';

import { AvatarCropper } from './avatar-cropper';
import { VoiceHealthPanel } from './voice-health';
import { VoicePicker } from './voice-picker';
import { ApiError } from '@/lib/api-error';
import {
  createCharacter,
  deleteAction,
  deleteCharacter,
  listCharacters,
  updateCharacter,
  upsertAction,
  type Character,
  type CharacterAction,
} from '@/lib/characters';
import { ownText, pickText } from '@/lib/i18n-text';
import { IMAGE_ACCEPT, uploadMedia } from '@/lib/media';
import { localizedPath } from '@/lib/routes';

/** Hai vai dùng chung màn hình này. Thứ tự này là thứ tự hai thẻ ở trên danh sách. */
const KINDS = ['player', 'npc'] as const;
type Kind = (typeof KINDS)[number];

/**
 * Quản lý nhân vật.
 *
 * Một nhân vật gồm ảnh đại diện, tên, tiểu sử, và một bộ **spritesheet cho từng
 * hành động** — idle, walk, run, jump, talk… Học sinh chọn nhân vật khi vào
 * world; Phaser vẽ nhân vật đó trong màn chơi bằng chính các spritesheet này.
 *
 * Ảnh đại diện và spritesheet là HAI thứ, không thay nhau được: một tấm chân
 * dung đẹp thì không cắt ra thành khung đi bộ được.
 *
 * **Người canh giữ (NPC) cũng ở đây**, phân biệt bằng `kind`. Không có màn quản
 * lý NPC riêng: cả hai vai cần đúng một bộ máy — tải spritesheet, cắt khung, xem
 * trước, chỉnh khung/giây. Tách ra là chép cả bộ đó lần thứ hai, rồi hai bản
 * lệch nhau ở đúng chỗ ai đó sửa một bên. Khác nhau chỉ ở BỘ TÊN tư thế được
 * gợi ý, và đó là một mảng, không phải một màn hình.
 */
export function CharacterManager({
  initialId,
  initialKind,
}: {
  initialId?: string;
  initialKind?: Kind;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [newName, setNewName] = useState('');
  //: Thẻ đang mở. Nó vừa lọc danh sách, vừa quyết định vai của nhân vật tạo mới
  //: — đang đứng ở thẻ "Người canh giữ" mà bấm Thêm thì ra một NPC. Một ô chọn
  //: vai nữa cạnh nút Thêm chỉ để nói lại điều màn hình đã nói rồi.
  const [kind, setKind] = useState<Kind>(initialKind ?? 'player');

  const reload = useCallback(async (): Promise<Character[] | null> => {
    try {
      const list = await listCharacters();
      setCharacters(list);
      setErrorKey(null);
      return list;
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload().then((list) => {
      // Mở sẵn thẻ ĐÚNG VAI của nhân vật được trỏ tới. Nút "Sửa ảnh" bên trình
      // thiết kế nhiệm vụ dẫn thẳng tới một NPC; tới nơi mà thẻ đang là "Nhân
      // vật" thì danh sách bên trái không dòng nào sáng lên, và người ta tưởng
      // đường dẫn hỏng chứ không nghĩ là mình đang đứng nhầm thẻ.
      const found = initialId ? list?.find((c) => c.id === initialId) : null;
      if (found) setKind(found.kind);
    });
  }, [reload, initialId]);

  function apply(updated: Character) {
    setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function guard<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
      return null;
    }
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    // CHỈ cần cái tên — ảnh và hành động thêm sau. Bắt điền đủ mọi thứ để tạo
    // một nhân vật rỗng là cách chắc chắn để không ai tạo nhân vật nào.
    const created = await guard(() => createCharacter({ kind, name_i18n: { [locale]: name } }));
    if (!created) return;
    setNewName('');
    await reload();
    setSelectedId(created.id);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const selected = characters.find((c) => c.id === selectedId) ?? null;
  const shown = characters.filter((c) => c.kind === kind);

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={[
          { label: t('teacher.title'), href: localizedPath('/teacher', locale) },
          { label: t('character.title') },
        ]}
      />
      <PageHeader title={t('character.title')} description={t('character.subtitle')} />

      {/* Dịch vụ giọng đọc còn sống không — hỏi ngay khi mở màn. Người dựng vào
          đây để GÁN GIỌNG, và biết dịch vụ đang hỏng trước khi chọn thì hơn là
          sau khi đã chọn xong và bấm sinh. Không tốn ký tự nào. */}
      <div className="mt-3">
        <VoiceHealthPanel />
      </div>

      {errorKey && (
        <p role="alert" className="mb-4 rounded-lg bg-coral-500/15 px-4 py-2 text-sm text-coral-500">
          {t(errorKey)}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[20rem_1fr]">
        <Card>
          <SectionTitle>{t('character.list', { count: shown.length })}</SectionTitle>

          <div className="mb-3 flex gap-1 rounded-lg bg-abyss-950/60 p-1">
            {KINDS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                  option === kind
                    ? 'bg-abyss-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(`character.kind.${option}`)}
                <span className="ml-1.5 font-mono text-[11px] text-slate-500">
                  {characters.filter((c) => c.kind === option).length}
                </span>
              </button>
            ))}
          </div>

          <div className="mb-3 flex gap-2">
            <input
              className="field-input"
              placeholder={t(`character.newName.${kind}`)}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void add();
              }}
            />
            <Button variant="primary" size="sm" disabled={!newName.trim()} onClick={() => void add()}>
              {t('character.add')}
            </Button>
          </div>

          {shown.length === 0 ? (
            <EmptyState label={t(`character.empty.${kind}`)} />
          ) : (
            <ul className="space-y-1">
              {shown.map((character) => (
                <li key={character.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(character.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                      character.id === selectedId
                        ? 'bg-abyss-700 text-slate-100'
                        : 'text-slate-300 hover:bg-abyss-800'
                    }`}
                  >
                    {character.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={character.avatar_url}
                        alt=""
                        className="size-8 shrink-0 rounded-full border border-abyss-700 object-cover"
                      />
                    ) : (
                      <span className="size-8 shrink-0 rounded-full border border-dashed border-abyss-700" />
                    )}
                    <span className="flex-1 truncate">{pickText(character.name_i18n, locale)}</span>
                    <span className="font-mono text-xs text-slate-500">
                      {character.actions?.length ?? 0}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <CharacterEditor
            key={selected.id}
            character={selected}
            locale={locale}
            onChanged={apply}
            onDeleted={() => {
              setSelectedId(null);
              void reload();
            }}
            onError={setErrorKey}
          />
        ) : (
          <Card>
            <EmptyState label={t('character.pickOne')} />
          </Card>
        )}
      </div>
    </div>
  );
}

function CharacterEditor({
  character,
  locale,
  onChanged,
  onDeleted,
  onError,
}: {
  character: Character;
  locale: string;
  onChanged: (updated: Character) => void;
  onDeleted: () => void;
  onError: (key: string) => void;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState<string | null>(null);
  const [newAction, setNewAction] = useState('');
  //: Đang mở trình cắt ảnh đại diện hay không.
  const [cropping, setCropping] = useState(false);

  const display = pickText(character.name_i18n, locale);
  //: `actions` có giá trị mặc định ở Pydantic nên OpenAPI sinh ra là optional.
  //: Chuẩn hoá MỘT LẦN ở đây thay vì rải `?? []` khắp nơi.
  const actions = character.actions ?? [];

  async function guard<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      onError(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
      return null;
    }
  }

  async function patch(payload: Parameters<typeof updateCharacter>[1]) {
    const updated = await guard(() => updateCharacter(character.id, payload));
    if (updated) onChanged(updated);
  }

  async function uploadAvatar(file: File) {
    setBusy('avatar');
    const asset = await guard(() => uploadMedia(file, 'characters'));
    if (asset) await patch({ avatar_media_id: asset.id });
    setBusy(null);
  }

  /**
   * Nhận ảnh đã cắt và đặt làm ảnh đại diện.
   *
   * Ảnh cắt lưu thành một tấm MỚI trong kho, ảnh gốc ở lại: ghi đè thứ giáo
   * viên đưa cho ta là một quyết định không thể hoàn tác, và cùng tấm đó có
   * thể đang được nhân vật khác dùng.
   */
  async function applyCrop(file: File) {
    setCropping(false);
    await uploadAvatar(file);
  }

  /**
   * Tải spritesheet cho một hành động.
   *
   * Khổ ảnh lấy từ chính phản hồi tải lên — server đo bằng Pillow. Trước đây
   * chỗ này tự nạp lại ảnh ở trình duyệt để đo; thừa một vòng tải, và con số
   * đo được thì không ai khác dùng lại được.
   */
  async function uploadSheet(actionKey: string, file: File, frames: number) {
    setBusy(actionKey);
    const asset = await guard(() => uploadMedia(file, 'character-sheets'));
    if (!asset) return setBusy(null);

    const existing = actions.find((a) => a.action_key === actionKey);
    const updated = await guard(() =>
      upsertAction(character.id, {
        action_key: actionKey,
        media_id: asset.id,
        frames,
        ...frameSize(asset.width, asset.height, frames),
        frame_rate: existing?.frame_rate ?? 10,
      }),
    );
    if (updated) onChanged(updated);
    setBusy(null);
  }

  async function addAction() {
    const key = newAction.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(key)) return;
    const updated = await guard(() =>
      upsertAction(character.id, { action_key: key, frames: 1, frame_rate: 10 }),
    );
    if (updated) {
      onChanged(updated);
      setNewAction('');
    }
  }

  const used = new Set(actions.map((a) => a.action_key));

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>{display}</SectionTitle>
          <div className="flex items-center gap-2">
            <Badge tone={character.status === 'published' ? 'success' : 'neutral'}>
              {t(character.status === 'published' ? 'status.published' : 'status.draft')}
            </Badge>
            {/* Đổi vai được, vì ai cũng có lúc tạo nhầm thẻ — và cách còn lại là
                xoá đi làm lại, mất luôn spritesheet đã tải. */}
            <select
              className="field-input w-auto py-1 text-xs"
              aria-label={t('character.kindLabel')}
              value={character.kind}
              onChange={(e) => void patch({ kind: e.target.value as Character['kind'] })}
            >
              <option value="player">{t('character.kind.player')}</option>
              <option value="npc">{t('character.kind.npc')}</option>
            </select>
            <Button
              variant={character.status === 'published' ? 'secondary' : 'primary'}
              size="sm"
              onClick={() =>
                void patch({
                  status: character.status === 'published' ? 'draft' : 'published',
                })
              }
            >
              {t(character.status === 'published' ? 'character.unpublish' : 'character.publish')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!window.confirm(t('character.confirmDelete'))) return;
                await guard(() => deleteCharacter(character.id));
                onDeleted();
              }}
            >
              {t('character.delete')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="field-label">{t('character.name')}</span>
            <input
              className="field-input"
              defaultValue={ownText(character.name_i18n, locale)}
              placeholder={display}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== ownText(character.name_i18n, locale)) {
                  void patch({ name_i18n: { ...character.name_i18n, [locale]: next } });
                }
              }}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="field-label">{t('character.bio')}</span>
            <textarea
              rows={2}
              className="field-input resize-y"
              defaultValue={ownText(character.bio_i18n, locale)}
              placeholder={pickText(character.bio_i18n, locale)}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== ownText(character.bio_i18n, locale)) {
                  void patch({ bio_i18n: { ...character.bio_i18n, [locale]: next } });
                }
              }}
            />
          </label>

          <div className="sm:col-span-3">
            <span className="field-label">{t('character.avatar')}</span>
            <div className="flex items-start gap-3">
              {/* Bấm thẳng vào ảnh là mở trình cắt — không có nút "Sửa" nào
                  bên cạnh. Cái ảnh CHÍNH LÀ nút: nó đã ở đúng chỗ, đủ to, và
                  là thứ người ta nhắm tới khi muốn sửa nó. */}
              {character.avatar_url && (
                <button
                  type="button"
                  onClick={() => setCropping(true)}
                  title={t('character.cropTitle')}
                  className="group relative size-16 shrink-0 overflow-hidden rounded-full border border-abyss-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={character.avatar_url} alt="" className="size-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-abyss-950/70 text-lg opacity-0 transition group-hover:opacity-100">
                    ✂
                  </span>
                </button>
              )}
              <div className="min-w-0 flex-1">
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  disabled={busy === 'avatar'}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAvatar(file);
                    e.target.value = '';
                  }}
                  className="block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-abyss-800 file:px-2.5 file:py-1 file:text-slate-200 hover:file:bg-abyss-700"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {t(character.avatar_url ? 'character.avatarCropHint' : 'character.avatarHint')}
                </p>
              </div>
            </div>
          </div>

          {/* GIỌNG ĐỌC, ngay cạnh ảnh đại diện: hai thứ cùng trả lời một câu
              hỏi — nhân vật này TRÔNG và NGHE ra sao. Cùng một ô cho cả nhân
              vật học sinh lẫn người canh giữ. */}
          <div className="sm:col-span-3">
            <VoicePicker
              value={character.voice_id ?? null}
              voice={character.voice ?? null}
              onPick={(voiceId) =>
                void patch(voiceId ? { voice_id: voiceId } : { clear_voice: true })
              }
              onError={onError}
            />
          </div>
        </div>
      </Card>

      {cropping && character.avatar_url && (
        <AvatarCropper
          sourceUrl={character.avatar_url}
          onCancel={() => setCropping(false)}
          onCropped={(file) => void applyCrop(file)}
        />
      )}

      <Card>
        <SectionTitle>{t('character.actions')}</SectionTitle>
        <p className="mb-3 text-xs text-slate-500">{t('character.actionsHint')}</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            className="field-input max-w-48"
            placeholder={t('character.newAction')}
            value={newAction}
            onChange={(e) => setNewAction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addAction();
            }}
          />
          <Button variant="primary" size="sm" onClick={() => void addAction()}>
            {t('character.addAction')}
          </Button>
        </div>

        {/* Gợi ý tên chuẩn, chia theo VIỆC chứ không đổ chung một đống. Ai cũng
            có thể gõ tên khác — `action_key` là chuỗi tự do — nhưng để mỗi nhân
            vật một bộ tên riêng thì cảnh chơi không biết gọi hành động nào.
            Chỉ hiện tư thế CÒN THIẾU: chip biến mất chính là dấu đã xong. */}
        <div className="mb-4 space-y-2">
          <Suggestions
            label={t('character.posesDialogue')}
            hint={t(`character.posesDialogueHint.${character.kind}`)}
            keys={DIALOGUE_POSES[character.kind].filter((key) => !used.has(key))}
            onPick={setNewAction}
          />
          {/* Người canh giữ đứng yên một chỗ và chỉ nói: nó không đi, không
              chạy, không nhảy. Gợi ý những tư thế đó là mời tải lên bảy tấm ảnh
              không màn nào vẽ tới. */}
          {character.kind === 'player' && (
            <Suggestions
              label={t('character.posesMotion')}
              keys={ACTION_SUGGESTIONS.filter((key) => !used.has(key))}
              onPick={setNewAction}
            />
          )}
        </div>

        {actions.length === 0 ? (
          <EmptyState label={t('character.noAction')} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                busy={busy === action.action_key}
                onUpload={(file, frames) => void uploadSheet(action.action_key, file, frames)}
                onPatch={(change) => {
                  // Đổi số khung thì bề rộng một khung phải tính lại theo. Giữ
                  // nguyên con số cũ là để lại một tấm ảnh cắt sai chỗ.
                  const frames = change.frames ?? action.frames;
                  void guard(() =>
                    upsertAction(character.id, {
                      action_key: action.action_key,
                      media_id: action.media_id,
                      frames: action.frames,
                      frame_width: action.frame_width,
                      frame_height: action.frame_height,
                      frame_rate: action.frame_rate,
                      ...change,
                      ...frameSize(action.sheet_width, action.sheet_height, frames),
                    }),
                  ).then((updated) => updated && onChanged(updated));
                }}
                onDelete={() =>
                  void guard(() => deleteAction(character.id, action.action_key)).then(
                    (updated) => updated && onChanged(updated),
                  )
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/**
 * Một hàng chip "còn thiếu tư thế này".
 *
 * Rỗng thì biến mất cả hàng, kể cả cái nhãn: một nhãn "Tư thế hội thoại" đứng
 * trên khoảng trống không nói được là đã đủ hay là màn hình hỏng.
 */
function Suggestions({
  label,
  hint,
  keys,
  onPick,
}: {
  label: string;
  hint?: string;
  keys: readonly string[];
  onPick: (key: string) => void;
}) {
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onPick(key)}
          className="rounded-full border border-abyss-700 px-2.5 py-0.5 text-xs text-slate-400 transition hover:border-lagoon-500 hover:text-lagoon-400"
        >
          + {key}
        </button>
      ))}
      {hint && <span className="basis-full text-xs text-slate-600">{hint}</span>}
    </div>
  );
}

function ActionRow({
  action,
  busy,
  onUpload,
  onPatch,
  onDelete,
}: {
  action: CharacterAction;
  busy: boolean;
  onUpload: (file: File, frames: number) => void;
  onPatch: (change: Partial<CharacterAction>) => void;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const [frames, setFrames] = useState(action.frames);
  //: Thu khung xem trước cho vừa thẻ. Khung thật của một tấm 5128px là 641px —
  //: to gấp đôi bề ngang cái thẻ chứa nó.
  const preview = spriteFrame(action, { w: 260, h: 180 });

  return (
    <li className="rounded-xl border border-abyss-800 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <code className="rounded bg-abyss-800 px-2 py-0.5 text-xs text-lagoon-400">
          {action.action_key}
        </code>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-slate-500 hover:text-coral-500"
        >
          {t('common.action.delete')}
        </button>
      </div>

      {/* Xem trước CHẠY THẬT, bằng CSS `steps()` — không cần nạp Phaser vào màn
          quản trị. Nguyên lý y hệt Phaser dùng: dịch nền đi từng khung một, mỗi
          giây `frame_rate` khung. Sai số khung hay sai cỡ khung lộ ra ngay ở
          đây, chứ không đợi tới lúc vào màn chơi. */}
      {action.media_url ? (
        <div
          className="mx-auto mb-2 rounded-lg border border-abyss-800 bg-abyss-950"
          style={preview.wrapperStyle}
          aria-label={t('character.previewRunning')}
        >
          <div style={preview.style} />
        </div>
      ) : (
        <p className="mb-2 rounded-lg border border-dashed border-abyss-800 p-3 text-center text-xs text-slate-500">
          {t('character.noSheet')}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="block w-20">
          <span className="field-label">{t('character.frames')}</span>
          <input
            type="number"
            min={1}
            max={240}
            className="field-input"
            value={frames}
            onChange={(e) => setFrames(Number(e.target.value))}
            onBlur={() => frames >= 1 && frames !== action.frames && onPatch({ frames })}
          />
        </label>

        <label className="block w-20">
          <span className="field-label">{t('character.frameRate')}</span>
          <input
            type="number"
            min={1}
            max={60}
            className="field-input"
            defaultValue={action.frame_rate}
            onBlur={(e) => {
              const next = Number(e.target.value);
              if (next >= 1 && next !== action.frame_rate) onPatch({ frame_rate: next });
            }}
          />
        </label>

        <div className="min-w-0 flex-1">
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file, frames);
              e.target.value = '';
            }}
            className="block w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-abyss-800 file:px-2.5 file:py-1 file:text-slate-200 hover:file:bg-abyss-700"
          />
          {action.sheet_width && (
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              {t('character.sheetSize', {
                w: action.sheet_width,
                h: action.sheet_height ?? 0,
              })}
              {action.frame_width ? ` → ${action.frame_width}×${action.frame_height}` : ''}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
