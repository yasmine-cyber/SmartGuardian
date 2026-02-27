import { useEffect } from 'react'
import { supabase } from './lib/supabase'

function App() {
  useEffect(() => {
    async function test() {
      const { data, error } = await supabase.from('profiles').select('count')
      console.log('Supabase connecté ✓', data, error)
    }
    test()
  }, [])

  return <div>SmartGuardian</div>
}

export default App