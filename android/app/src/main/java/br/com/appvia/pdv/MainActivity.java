package br.com.appvia.pdv;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(PagBankPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
