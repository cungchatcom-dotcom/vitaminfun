'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api-error';
import { ownText, pickText } from '@/lib/i18n-text';
import { IMAGE_ACCEPT, uploadMedia } from '@/lib/media';
import { EMPTY_SITE_CONFIG, getSiteConfig, saveSiteConfig, type SiteConfig } from '@/lib/site';

/**
 * CẤU HÌNH CHUNG của cả trang — tên trang và biểu tượng tab.
 *
 * Hai thứ nhỏ, nhưng chúng là cái bảng hiệu treo trước cửa: thứ đầu tiên người
 * dùng thấy khi mở tab, và thứ duy nhất còn lại khi tab bị thu nhỏ. Một trường
 * học cài bản này muốn tên mình ở đó, và đó là việc của người dựng nội dung —
 * không phải việc của người có SSH vào máy chủ.
 *
 * Màn này CỐ Ý mỏng. Nó sẽ còn dài ra (ảnh mở đầu, màu chủ đạo, liên hệ…), nên
 * mỗi nhóm là một `Card` riêng: thêm nhóm mới là thêm một thẻ, không phải sắp
 * xếp lại cả trang.
 */
export function SiteConfigForm() {
  const t = useTranslations('siteConfig');
  const tError = useTranslations('error');
  const locale = useLocale();
  const router = useRouter();

  const [config, setConfig] = useState<SiteConfig>(EMPTY_SITE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [mo, setMo] = useState(50);
  const oFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSiteConfig()
      .then((c) => {
        setConfig(c);
        setMo(c.locked_stage_opacity ?? 50);
      })
      .catch((error: unknown) =>
        setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR'),
      )
      .finally(() => setLoading(false));
  }, []);

  async function luu(payload: Parameters<typeof saveSiteConfig>[0]) {
    setSaving(true);
    setErrorKey(null);
    setNote(null);
    try {
      setConfig(await saveSiteConfig(payload));
      setNote(t('saved'));
      // Tiêu đề và favicon dựng ở SERVER (`generateMetadata` của layout), nên
      // đổi xong phải bảo Next dựng lại — không thì tab vẫn mang tên cũ cho tới
      // lần tải trang sau.
      router.refresh();
    } catch (error) {
      setErrorKey(error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-8 text-slate-400">{t('loading')}</p>;

  const ten = ownText(config.title_i18n ?? {}, locale);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('title')} description={t('subtitle')} />

      {errorKey && (
        <p role="alert" className="mb-4 rounded-lg bg-coral-500/15 px-4 py-2 text-sm text-coral-500">
          {tError(errorKey.replace(/^error\./, ''))}
        </p>
      )}
      {note && <p className="mb-4 text-sm text-emerald-400">✓ {note}</p>}

      <Card className="mb-6">
        <SectionTitle>{t('siteTitle')}</SectionTitle>
        <p className="mb-2 text-xs text-slate-500">{t('siteTitleHint')}</p>

        {/* Ô SỬA chỉ hiện bản dịch của ĐÚNG ngôn ngữ đang xem — mượn của ngôn
            ngữ khác thì chỉ cần rời chuột là bản tiếng Anh bị ghi thành bản
            tiếng Việt mà chẳng ai gõ chữ nào. Bản kia xuống `placeholder` để
            còn đối chiếu. Đổi ngôn ngữ bằng nút ở thanh đầu trang. */}
        <input
          className="field-input w-full"
          defaultValue={ten}
          placeholder={pickText(config.title_i18n ?? {}, locale) || t('siteTitlePlaceholder')}
          onBlur={(event) => {
            const chu = event.target.value.trim();
            if (chu === ten) return;
            const next = { ...(config.title_i18n ?? {}) };
            if (chu) next[locale] = chu;
            else delete next[locale];
            void luu({ title_i18n: next });
          }}
        />
        <p className="mt-1 text-[11px] text-slate-600">{t('perLocale', { locale })}</p>
      </Card>

      {/* ĐỘ MỜ CỦA MÀN ĐANG KHOÁ.
          Độ mờ chứ không phải một lớp đen phủ lên: lớp đen giữ nguyên hình khối
          và chỉ rút ánh sáng ra, nên vặn mạnh là cái chấm thành một đồng xu đen
          — vẫn to tiếng trên bản đồ, chỉ là không đọc được nữa. Bao nhiêu là
          vừa thì phụ thuộc vào chính những tấm ảnh người dựng tải lên, tức thứ
          chỉ họ nhìn thấy. */}
      <Card className="mb-6">
        <SectionTitle>{t('lockedOpacity')}</SectionTitle>
        <p className="mb-3 text-xs text-slate-500">{t('lockedOpacityHint')}</p>

        <div className="flex flex-wrap items-center gap-4">
          <input
            type="range"
            // Sàn 10%, không phải 0: kéo hết cỡ xuống 0 là màn chơi BIẾN MẤT
            // khỏi bản đồ, mà cả lý do giữ nó hiện ra là để lớp biết còn có gì
            // phía trước. Một thanh kéo làm được điều ngược hẳn ý định của
            // chính nó thì không phải một lựa chọn, nó là một cái bẫy.
            min={10}
            max={100}
            step={5}
            value={mo}
            // KÉO thì chỉ đổi trên màn hình; NHẢ TAY mới lưu. Lưu theo từng
            // nấc kéo là hai chục lần gọi mạng cho một lần chỉnh.
            onChange={(e) => setMo(Number(e.target.value))}
            onPointerUp={() => void luu({ locked_stage_opacity: mo })}
            onKeyUp={() => void luu({ locked_stage_opacity: mo })}
            className="h-2 w-64 max-w-full accent-lagoon-500"
          />
          <span className="w-12 font-mono text-sm text-slate-200">{mo}%</span>

          {/* XEM THỬ ngay tại chỗ: hai vòng tròn cạnh nhau trên cùng một tấm nền
              giả, một cái mở và một cái khoá. Con số phần trăm không nói được
              "mờ chừng nào là vừa"; hai vòng tròn cạnh nhau thì nói được. */}
          <div className="flex items-center gap-3 rounded-xl bg-abyss-950/60 p-2">
            {[false, true].map((khoa) => (
              <span
                key={String(khoa)}
                className="relative flex size-14 items-center justify-center overflow-hidden rounded-full border-2"
                style={{
                  borderColor: khoa ? 'rgba(255,255,255,0.3)' : '#f0b429',
                  backgroundImage:
                    'linear-gradient(135deg,#2dd4bf 0%,#0ea5e9 45%,#a855f7 100%)',
                  // Chỉ ĐỘ MỜ. Không xám, không tối — xem thử phải giống hệt
                  // thứ màn chơi vẽ ra, nếu không thì nó không phải xem thử.
                  opacity: khoa ? mo / 100 : undefined,
                }}
              >
                {!khoa && <span className="absolute inset-0 bg-abyss-950/55" />}
                {/* Giống hệt màn thật: tên ở CÙNG MỘT CHỖ trên cả hai, ổ khoá
                    đè lên giữa. Xem thử mà vẽ khác đi thì nó không phải xem thử. */}
                <span className="relative text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {t('lockedOpacityPreview')}
                </span>
                {khoa && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                    🔒
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('favicon')}</SectionTitle>
        <p className="mb-3 text-xs text-slate-500">{t('faviconHint')}</p>

        <div className="flex flex-wrap items-center gap-4">
          {/* Ô 32px — ĐÚNG CỠ nó sẽ được nhìn thấy. Xem thử ở 200px thì một ảnh
              nhiều chi tiết trông vẫn đẹp, rồi trên tab thật là một vệt mờ. */}
          {config.favicon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.favicon_url}
              alt=""
              className="size-8 rounded border border-abyss-700 bg-abyss-950 object-contain"
            />
          ) : (
            <span className="size-8 rounded border border-dashed border-abyss-700" />
          )}

          <input
            ref={oFile}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              // Xoá giá trị NGAY: chọn lại đúng file vừa chọn phải kích hoạt
              // lần nữa, không thì "tải lại ảnh cũ" là một cú bấm im lặng.
              event.target.value = '';
              if (!file) return;
              setSaving(true);
              setErrorKey(null);
              setNote(null);
              try {
                const asset = await uploadMedia(file, 'site');
                await luu({ favicon_media_id: asset.id });
              } catch (error) {
                setErrorKey(
                  error instanceof ApiError ? error.messageKey : 'error.INTERNAL_ERROR',
                );
                setSaving(false);
              }
            }}
          />

          <Button variant="secondary" loading={saving} onClick={() => oFile.current?.click()}>
            {config.favicon_url ? t('faviconReplace') : t('faviconUpload')}
          </Button>

          {config.favicon_url && (
            <Button variant="ghost" disabled={saving} onClick={() => void luu({ clear_favicon: true })}>
              {t('faviconRemove')}
            </Button>
          )}
        </div>

        <p className="mt-3 text-[11px] text-slate-600">{t('faviconSize')}</p>
      </Card>
    </div>
  );
}
