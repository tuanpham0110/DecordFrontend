export const NAV_ITEMS = [
    { to: '/tong-quan', publicTo: '/', label: 'Trang chủ', icon: 'home', group: 'learn' },
    { to: '/bai-hoc', label: 'Bài học', icon: 'book', group: 'learn' },
    { to: '/on-luyen', label: 'Ôn luyện', icon: 'target', group: 'learn', badge: 'due' },
    { to: '/so-tay', label: 'Sổ tay', icon: 'notebook', group: 'ref' },
    { to: '/cam-nang', label: 'Cẩm nang', icon: 'guide', group: 'ref' },
    { to: '/ho-tro', label: 'Hỗ trợ', icon: 'mail', group: 'ref', badge: 'support', appOnly: true },
];

export const NAV_GROUPS = [
    { key: 'learn', label: 'Học tập' },
    { key: 'ref', label: 'Tra cứu' },
];
