import { Button, EmptyState } from '../components/ui.jsx';

export default function NotFound() {
    return (
        <main className="container" style={{ paddingBlock: '64px' }}>
            <EmptyState title="Không tìm thấy trang" action={<Button to="/">Về trang chủ</Button>}>
                Đường dẫn có thể đã thay đổi hoặc không tồn tại.
            </EmptyState>
        </main>
    );
}
