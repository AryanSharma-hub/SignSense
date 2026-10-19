import { StepsBar } from './StepsBar.jsx';
import { ParameterPanels } from './ParameterPanels.jsx';
import { Icon } from './ui.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useRouter } from '../lib/router.js';

/**
 * The query builder: the step-by-step timeline of the sign being built (it is also the
 * search query the Suggestions panel matches against), with the keyboard-friendly
 * precise controls folded underneath. Administrators can turn what they built into a new
 * library sign — the steps open in the dashboard's sign editor.
 */
export function QueryBuilder({ composer, vocab }) {
  const { isAdmin } = useAuth();
  const { navigate } = useRouter();
  const saveAsSign = () => {
    try { sessionStorage.setItem('signsense:new-sign-steps', JSON.stringify(composer.arraySteps)); } catch { /* ignore */ }
    navigate('/admin/signs');
  };
  return (
    <div className="flex min-h-full flex-col gap-3">
      <StepsBar composer={composer} vocab={vocab} />
      {isAdmin && composer.arraySteps.length > 0 && (
        <button type="button" className="btn self-start !min-h-[38px] text-[14px]" onClick={saveAsSign}>
          <Icon name="plus" size={15} /> Save as new sign (admin)
        </button>
      )}
      <ParameterPanels composer={composer} vocab={vocab} />
    </div>
  );
}
