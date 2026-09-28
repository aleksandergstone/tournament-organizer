// A screen that is being reworked: shown instead of the feature so nothing
// links into a dead end. Deliberately calm — no teaser, no placeholder art.
import { Empty, Page } from './kit';
import { useT } from '../i18n';

export default function ComingSoon({ title }: { title: 'codes' }) {
  const t = useT();
  return (
    <Page title={t('soon.title')}>
      <Empty
        title={t(title === 'codes' ? 'nav.codes' : 'soon.title')}
        hint={t('soon.qr')}
      />
    </Page>
  );
}
