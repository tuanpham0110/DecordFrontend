import { Link, useParams } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { STAGES } from '../data/content.js';

export default function Lesson() {
    const { lessonId } = useParams();
    const stage = STAGES.find((s) => s.lessons.some((l) => l.id === Number(lessonId)));
    const lesson = stage?.lessons.find((l) => l.id === Number(lessonId));

    if (!lesson) {
        return (
            <EmptyState title="Không tìm thấy bài học" action={<Button to="/bai-hoc">Về hành trình</Button>}>
                Bài học này không tồn tại hoặc đã được di chuyển.
                </EmptyState>
        );
    }

    return (
        <div className="stage-page">
            <Link to={`/bai-hoc/chang/${stage.id}`} className="auth-back">
                <Icon name="arrow-left" size={16} />
                Chặng {stage.id}: {stage.title}
            </Link>
            <div className="panel">
                <EmptyState
                    title={`Bài ${lesson.id}: ${lesson.title}`}
                    art="/assets/mascot-book.webp"
                    action={
                        <div className="row-actions">
                            <Button to="/on-luyen" iconRight="arrow-right">
                                Ôn luyện từ vựng
                            </Button>
                            <Button to={`/bai-hoc/chang/${stage.id}`} variant="light">
                                Về danh sách bài
                            </Button>
                        </div>
                    }
                >
                    Nội dung bài học đang được đội ngũ biên soạn hoàn thiện. Trong lúc chờ, bạn có thể ôn lại các từ đã học.
                </EmptyState>
            </div>
        </div>
    );
}
