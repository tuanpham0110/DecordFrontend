const DAY = 86400000;

function startOfDay(t) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/** "Hôm nay, 10:24" · "Hôm qua, 21:10" · "12/11, 08:00" */
export function formatWhen(ts) {
    const d = new Date(ts);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
    if (diff === 0) return `Hôm nay, ${time}`;
    if (diff === 1) return `Hôm qua, ${time}`;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, ${time}`;
}

/** Relative due time for review cards. */
export function formatDue(ts) {
    if (ts == null) return 'Đã thuộc';
    const diff = ts - Date.now();
    if (diff <= 0) return 'Đến hạn ôn';
    const days = Math.ceil(diff / DAY);
    return days <= 1 ? 'Ôn lại ngày mai' : `Ôn lại sau ${days} ngày`;
}

export const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
