import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import styles from '@site/src/pages/404.module.css';

export default function NotFoundKo() {
  return (
    <Layout
      title="404 — 페이지를 찾을 수 없습니다"
      description="찾으시는 페이지가 여기에 없습니다. 가이드, 명세, 또는 변환기를 살펴보세요."
    >
      <main className={styles.page}>
        <div className="container">
          <p className={styles.code}>404</p>
          <h1 className={styles.title}>이 워크북에는 그런 페이지가 없습니다.</h1>
          <p className={styles.body}>
            따라오신 URL이 xl3.io의 어떤 페이지와도 맞지 않습니다. 아래
            카드 중 하나를 눌러 사이트의 주요 영역으로 이동하세요.
          </p>

          <div className={styles.cards}>
            <Link className={styles.card} to="/">
              <strong>홈</strong>
              <span>xl3 한국어 랜딩 페이지</span>
            </Link>
            <Link className={styles.card} to="/guides">
              <strong>가이드</strong>
              <span>복사해서 바로 쓰는 짧은 레시피 18 개</span>
            </Link>
            <Link className={styles.card} to="/spec/">
              <strong>명세</strong>
              <span>XTL 0.1 언어 레퍼런스 (영문)</span>
            </Link>
            <Link className={styles.card} to="/try">
              <strong>변환기</strong>
              <span>브라우저에서 xl3 바로 실행</span>
            </Link>
            <Link className={clsx(styles.card, styles.outbound)} href="https://github.com/xl3-lang/xl3">
              <strong>GitHub</strong>
              <span>소스 코드, 이슈, 토론</span>
            </Link>
            <Link className={styles.card} to="/porters-guide">
              <strong>포팅 가이드</strong>
              <span>다른 언어 구현체용 가이드 (영문)</span>
            </Link>
          </div>

          <p className={styles.foot}>
            이 URL이 정상적으로 동작해야 한다고 생각하시면{' '}
            <Link href="https://github.com/xl3-lang/xl3/issues">이슈로 알려주세요</Link>.
          </p>
        </div>
      </main>
    </Layout>
  );
}
