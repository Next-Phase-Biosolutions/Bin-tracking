import { useNavigate } from 'react-router-dom';
import { FormBuilder } from './FormBuilder';

export function FormBuilderPage() {
    const navigate = useNavigate();
    return <FormBuilder onBack={() => navigate('/app/forms')} />;
}

export default FormBuilderPage;
