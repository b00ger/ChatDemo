import { QuickButtonTypes } from 'src/store/types';
import '../../../../../../../../scss/QuickButton.scss';

type Props = {
  button: QuickButtonTypes;
  onQuickButtonClicked: (event: any, value: string | number) => any;
}

function QuickButton({ button, onQuickButtonClicked }: Props) {
  return (
    <button className="quick-button" onClick={(event) => onQuickButtonClicked(event, button.value)}>
      {button.label}
    </button>
  );
}

export default QuickButton;
