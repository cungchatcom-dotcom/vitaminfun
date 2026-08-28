"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Bọc một hành động bất đồng bộ để nó KHÔNG BAO GIỜ chạy chồng lên chính nó.
 *
 * Dùng cho `form.onSubmit` và mọi thao tác ghi dữ liệu.
 *
 * VÌ SAO KHÔNG DỰA VÀO NÚT BẤM LÀ ĐỦ:
 * Trong form, nhấn phím Enter cũng gửi form mà không đi qua sự kiện click của
 * nút. Chỉ khoá ở nút thì gõ Enter liên tục vẫn gửi được nhiều lần.
 *
 * VÌ SAO DÙNG useRef CHỨ KHÔNG DÙNG useState LÀM CHỐT:
 * `setState` là bất đồng bộ. Hai cú gửi cách nhau vài mili giây sẽ cùng đọc
 * được giá trị cũ `false` và cùng lọt qua. `useRef` đổi giá trị ngay lập tức
 * nên chốt mới thực sự chặn được.
 */
export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<unknown>,
): { run: (...args: TArgs) => Promise<void>; pending: boolean } {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: TArgs) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      try {
        await action(...args);
      } finally {
        inFlight.current = false;
        // Component có thể đã bị gỡ do điều hướng sang trang khác
        if (mounted.current) setPending(false);
      }
    },
    [action],
  );

  return { run, pending };
}
